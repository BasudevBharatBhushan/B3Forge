// `validate`: deterministic structural checks for tickets, the active-tickets registry and the
// behavior book. Output: `<path>:<line>  <error|warning>  <message>`, then a summary line.
// Exit 0 = no errors (warnings allowed), 1 = errors, 2 = bad usage / unknown ticket.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { die, present } from '../fs-safe';
import { STATUSES, TYPES, findTicketFile, listTicketFiles, parseBehaviorArea, parseRegistry, parseTicket, ticketIdOf } from '../ticket/parse';
import type { BehaviorRule, RegistryRow, Ticket } from '../ticket/parse';
import type { Options } from '../types';

interface Problem { file: string; line: number; severity: 'error' | 'warning'; message: string }

const REQUIRED = ['Status', 'Scope', 'Type', 'Date', 'Current subtask', 'Files'];
const REQUIRED_PARENT = ['Status', 'Scope', 'Type', 'Date', 'Active child', 'Children', 'Blocked'];
const AGENTS = ['impl-small', 'impl-mid'];
const MAX_TICKET_LINES = 170;
const MAX_PART_A_LINES = 25;
const key = (name: string): string => name.trim().replace(/\s+/g, ' ').toLowerCase();
const areaSlug = (area: string): string => area.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstWord = (value: string, re: RegExp): string => (value.match(re) || [''])[0];

export function validate(target: string, options: Options): void {
  const workspace = path.join(target, 'ai-workspace');
  if (!present(workspace)) die('no ai-workspace/ directory in target; nothing to validate', 2);
  const rel = (file: string): string => path.relative(target, file).split(path.sep).join('/');
  const ticketsDir = path.join(workspace, 'tickets');
  const registryFile = path.join(workspace, 'active-tickets');
  const behaviorDir = path.join(workspace, 'behavior');
  const problems: Problem[] = [];
  const add = (file: string, line: number, severity: Problem['severity'], message: string): void => { problems.push({ file: rel(file), line, severity, message }); };

  const registry: RegistryRow[] = present(registryFile) ? parseRegistry(fs.readFileSync(registryFile, 'utf8')) : [];
  const book = new Map<string, { file: string; rules: BehaviorRule[] }>();
  if (present(behaviorDir)) for (const name of fs.readdirSync(behaviorDir).sort()) {
    if (name.endsWith('.md') && name.toLowerCase() !== 'readme.md') book.set(areaSlug(name.slice(0, -3)), { file: path.join(behaviorDir, name), rules: parseBehaviorArea(fs.readFileSync(path.join(behaviorDir, name), 'utf8')) });
  }

  let names: string[];
  if (options.ticket) {
    const found = findTicketFile(ticketsDir, options.ticket);
    if (!found) die(`ticket not found: ${options.ticket}`, 2);
    names = [found];
  } else names = listTicketFiles(ticketsDir);
  const only = options.ticket;

  const checkTicket = (name: string): void => {
    const file = path.join(ticketsDir, name); const id = ticketIdOf(name);
    const t: Ticket = parseTicket(fs.readFileSync(file, 'utf8'));
    const parent = 'Children' in t.header; // a module-addition parent has its own header and no B5/B7
    const err = (line: number, message: string): void => add(file, line, 'error', message);

    // Header
    for (const field of parent ? REQUIRED_PARENT : REQUIRED) if (!(field in t.header)) err(1, `missing header field "${field}"`);
    const status = t.header.Status ? firstWord(t.header.Status.value, /^[A-Z_]+/) : '';
    const type = t.header.Type ? firstWord(t.header.Type.value, /^[a-z-]+/) : '';
    if (t.header.Status && !STATUSES.includes(status)) err(t.header.Status.line, `invalid Status "${t.header.Status.value}" (expected ${STATUSES.join(' | ')})`);
    if (t.header.Type && !TYPES.includes(type)) err(t.header.Type.line, `invalid Type "${t.header.Type.value}" (expected ${TYPES.join(' | ')})`);

    // Size
    if (t.totalLines > MAX_TICKET_LINES) err(MAX_TICKET_LINES + 1, `ticket is ${t.totalLines} lines (max ${MAX_TICKET_LINES})`);
    if (!t.partA) err(1, 'missing "# Part A" section');
    else if (t.partA.lines > MAX_PART_A_LINES) err(t.partA.start, `Part A is ${t.partA.lines} lines (max ${MAX_PART_A_LINES})`);

    // Subtasks
    for (const s of t.subtasks) {
      if (!AGENTS.includes(s.agent)) err(s.line, `subtask ${s.id} has Agent "${s.agent}" (must be impl-small or impl-mid)`);
      if (s.state === '?') err(s.line, `subtask ${s.id} has an unrecognized Done marker (use [ ], [~] or [x])`);
    }

    // B7
    if (!parent) {
      if (!t.b7) err(1, 'missing section "## B7. Behavior changes"');
      else {
        if (t.b7.none !== null && type !== 'refactor' && type !== 'chore') err(t.b7.none, `"None — no behavior change" is only allowed for refactor and chore tickets (Type is ${type || 'unknown'})`);
        if (t.b7.none === null && !t.b7.entries.length) err(t.b7.line, 'B7 lists no rules and has no "None — no behavior change" line');
      }
    }

    // Completion
    if (status === 'COMPLETED') {
      for (const s of t.subtasks) if (s.state === ' ' || s.state === '~') err(s.line, `COMPLETED ticket has unfinished subtask ${s.id}`);
      for (const row of registry) if (row.ticket === id) add(registryFile, row.line, 'error', `COMPLETED ticket ${id} is still in active-tickets`);
      for (const e of t.b7 ? t.b7.entries : []) {
        if (!e.area) { err(e.line, `B7 rule "${e.rule}" has no **Area:** line`); continue; }
        const area = book.get(areaSlug(e.area));
        const exists = !!area && area.rules.some((r) => key(r.name) === key(e.rule));
        if (e.kind === 'REMOVED' && exists) err(e.line, `COMPLETED ticket removes rule "${e.rule}" but it is still in behavior/${areaSlug(e.area)}.md`);
        else if (e.kind !== 'REMOVED' && !exists) err(e.line, `COMPLETED ticket ${e.kind} rule "${e.rule}" is not in behavior/${areaSlug(e.area)}.md`);
      }
    }
  };
  for (const name of names) checkTicket(name);

  // Registry
  const rows = only ? registry.filter((r) => r.ticket === only) : registry;
  for (const row of rows) {
    const ticketFile = row.path ? path.join(target, row.path) : '';
    if (!row.path || !present(ticketFile) || !fs.statSync(ticketFile).isFile()) { add(registryFile, row.line, 'error', `${row.ticket} points to a missing ticket file "${row.path}"`); continue; }
    const header = parseTicket(fs.readFileSync(ticketFile, 'utf8')).header.Status;
    const actual = header ? firstWord(header.value, /^[A-Z_]+/) : '';
    if (actual !== row.status) add(registryFile, row.line, 'error', `${row.ticket} status mismatch: active-tickets says "${row.status}", ticket says "${actual}"`);
  }
  const owner = new Map<string, RegistryRow>();
  for (const row of registry) for (const claimed of row.claimed) {
    const first = owner.get(claimed);
    if (!first) { owner.set(claimed, row); continue; }
    const family = first.ticket.startsWith(`${row.ticket}.`) || row.ticket.startsWith(`${first.ticket}.`);
    if (first.ticket !== row.ticket && !family && (!only || row.ticket === only || first.ticket === only)) add(registryFile, row.line, 'warning', `${row.ticket} and ${first.ticket} both claim "${claimed}"`);
  }

  // Behavior book (whole-project runs only)
  if (!only) for (const { file, rules } of book.values()) {
    const seen = new Map<string, BehaviorRule>();
    for (const r of rules) {
      if (!r.name) add(file, r.line, 'error', 'rule has no name');
      if (!r.hasWhen) add(file, r.line, 'error', `rule "${r.name}" has no WHEN line`);
      if (!r.hasThen) add(file, r.line, 'error', `rule "${r.name}" has no THEN line`);
      const first = seen.get(key(r.name));
      if (first) add(file, r.line, 'error', `duplicate rule "${r.name}" (first defined at line ${first.line})`); else seen.set(key(r.name), r);
    }
  }

  const errors = problems.filter((p) => p.severity === 'error').length; const warnings = problems.length - errors;
  const summary = `${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'} (${names.length} ticket${names.length === 1 ? '' : 's'}${only ? '' : `, ${book.size} behavior area${book.size === 1 ? '' : 's'}`}, ${rows.length} registry row${rows.length === 1 ? '' : 's'})`;
  if (options.json || options.format === 'json') console.log(JSON.stringify({ problems, errors, warnings }, null, 2));
  else { for (const p of problems) console.log(`${p.file}:${p.line}  ${p.severity}  ${p.message}`); console.log(summary); }
  process.exitCode = errors ? 1 : 0;
}
