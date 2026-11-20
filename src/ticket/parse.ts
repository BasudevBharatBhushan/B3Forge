// Shared parsers for ticket files, the active-tickets registry and behavior-book area files.
// Pure functions over text (plus two small directory helpers); no process exits here.
// HTML comments are blanked before parsing (line numbers preserved) so the template's
// instructional comments, which quote `None — no behavior change` and `[ ]`, never count.
import * as fs from 'node:fs';
import * as path from 'node:path';

export type SubtaskState = ' ' | '~' | 'x' | '?';
export type B7Kind = 'ADDED' | 'CHANGED' | 'REMOVED';

export interface HeaderField { value: string; line: number }
export interface Subtask { id: string; state: SubtaskState; agent: string; line: number }
export interface B7Entry { kind: B7Kind; rule: string; area: string | null; line: number }
export interface B7Section { line: number; entries: B7Entry[]; none: number | null }
export interface PartA { start: number; end: number; lines: number }
export interface Ticket {
  totalLines: number;
  title: { id: string; text: string; line: number } | null;
  header: Record<string, HeaderField>;
  partA: PartA | null;
  subtasks: Subtask[];
  b7: B7Section | null;
  /** Pre-0.3 format: B7 is "Decisions & Blockers" and there is no behavior-changes section. */
  legacy: boolean;
}
export interface RegistryRow { ticket: string; path: string; status: string; subtask: string; claimed: string[]; line: number }
export interface BehaviorRule { name: string; line: number; hasWhen: boolean; hasThen: boolean }

export const STATUSES = ['TODO', 'IN_PROGRESS', 'AWAITING_TEST', 'COMPLETED', 'BLOCKED'];
export const TYPES = ['module-addition', 'feature-addition', 'enhancement', 'bug-fix', 'refactor', 'migration', 'chore', 'security-fix'];

/** Replace every HTML comment with nothing, keeping its newlines so line numbers stay true. */
export function stripComments(text: string): string[] {
  return text.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, '')).split(/\r?\n/);
}
const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isTableRow = (line: string): boolean => /^\s*\|/.test(line);
const isSeparator = (line: string): boolean => /^\s*\|[\s:|-]+\|?\s*$/.test(line);
const plain = (value: string): string => value.replace(/`/g, '').trim();

export function parseTicket(text: string): Ticket {
  const raw = text.split(/\r?\n/);
  const totalLines = raw.length && raw[raw.length - 1] === '' ? raw.length - 1 : raw.length;
  const lines = stripComments(text);
  const ticket: Ticket = { totalLines, title: null, header: {}, partA: null, subtasks: [], b7: null, legacy: false };

  const titleAt = lines.findIndex((l) => /^# T-\d/.test(l));
  if (titleAt >= 0) { const m = lines[titleAt].match(/^# (T-\d+(?:\.\d+)?)\s*:?\s*(.*)$/); if (m) ticket.title = { id: m[1], text: m[2], line: titleAt + 1 }; }

  // Resume header: bold-key lines before the first `---` rule or Part A heading.
  for (let i = 0; i < lines.length; i++) {
    if (/^---\s*$/.test(lines[i]) || /^# Part A/.test(lines[i])) break;
    const m = lines[i].match(/^\*\*([^*:]+):\*\*\s*(.*)$/);
    if (m && !(m[1] in ticket.header)) ticket.header[m[1].trim()] = { value: m[2].trim(), line: i + 1 };
  }

  // Part A runs from its heading to the line before the next `---` rule or `# Part B`;
  // trailing blank lines are not counted.
  const a = lines.findIndex((l) => /^# Part A\b/.test(l));
  if (a >= 0) {
    let end = lines.length;
    for (let i = a + 1; i < lines.length; i++) if (/^---\s*$/.test(lines[i]) || /^# Part B\b/.test(lines[i])) { end = i; break; }
    while (end > a + 1 && lines[end - 1].trim() === '') end--;
    ticket.partA = { start: a + 1, end, lines: end - a };
  }

  // Subtask table: any table whose header row has an Agent column.
  let agentCol = -1; let doneCol = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isTableRow(line)) { agentCol = -1; continue; }
    if (isSeparator(line)) continue;
    const c = cells(line);
    const agent = c.findIndex((x) => /^agent$/i.test(x));
    if (agent >= 0) { agentCol = agent; doneCol = c.findIndex((x) => /^done$/i.test(x)); if (doneCol < 0) doneCol = c.length - 1; continue; }
    if (agentCol < 0 || !/^\d+(?:\.\d+)?$/.test(c[0])) continue;
    const mark = (c[doneCol] || '').match(/^\[([ ~xX])\]$/);
    ticket.subtasks.push({ id: c[0], agent: plain(c[agentCol] || ''), state: mark ? (mark[1].toLowerCase() as SubtaskState) : '?', line: i + 1 });
  }

  // B7: from its `## B7` heading to the next `##`/`#` heading.
  const b = lines.findIndex((l) => /^##\s+B7\b/.test(l));
  if (b >= 0) {
    const b7: B7Section = { line: b + 1, entries: [], none: null };
    let area: string | null = null;
    for (let i = b + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^#{1,2}\s/.test(line)) break;
      const am = line.match(/^\*\*Area:\*\*\s*(.+?)\s*$/);
      if (am) { area = am[1]; continue; }
      const em = line.match(/^###\s+(ADDED|CHANGED|REMOVED)\s+Rule:\s*(.+?)\s*$/);
      if (em) { b7.entries.push({ kind: em[1] as B7Kind, rule: em[2], area, line: i + 1 }); continue; }
      if (b7.none === null && /^\s*None\s*[—–-]+\s*no behavior change\s*\.?\s*$/i.test(line)) b7.none = i + 1;
    }
    ticket.b7 = b7;
  }
  ticket.legacy = lines.some((l) => /^##\s+B7\.?\s*Decisions/i.test(l)) && !lines.some((l) => /^##\s.*Behavior changes/i.test(l));
  return ticket;
}

/** `active-tickets` rows. Header, separator and the "— no tickets in flight" placeholder are skipped. */
export function parseRegistry(text: string): RegistryRow[] {
  const rows: RegistryRow[] = [];
  stripComments(text).forEach((line, i) => {
    if (!isTableRow(line) || isSeparator(line)) return;
    const c = cells(line);
    const ticket = plain(c[0] || '').match(/^T-\d+(?:\.\d+)?/);
    if (!ticket) return;
    const claimed = [...(c[4] || '').matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter((x) => !/^T-\d/.test(x));
    rows.push({ ticket: ticket[0], path: plain(c[1] || ''), status: (plain(c[2] || '').match(/^[A-Z_]+/) || [''])[0], subtask: c[3] || '', claimed, line: i + 1 });
  });
  return rows;
}

/** Rules in one behavior-book area file: `## Rule: name` blocks with their WHEN/THEN lines. */
export function parseBehaviorArea(text: string): BehaviorRule[] {
  const rules: BehaviorRule[] = [];
  let current: BehaviorRule | null = null;
  stripComments(text).forEach((line, i) => {
    const m = line.match(/^##\s+Rule:\s*(.*?)\s*$/);
    if (m) { current = { name: m[1], line: i + 1, hasWhen: false, hasThen: false }; rules.push(current); return; }
    if (/^#{1,2}\s/.test(line)) { current = null; return; }
    if (current && /^\s*[-*]\s*WHEN\b/.test(line)) current.hasWhen = true;
    if (current && /^\s*[-*]\s*THEN\b/.test(line)) current.hasThen = true;
  });
  return rules;
}

/** Ticket files are `T-NNN-slug.md` (children `T-NNN.M-slug.md`). */
export const TICKET_FILE = /^T-\d+(?:\.\d+)?(?:-.*)?\.md$/;
export function ticketIdOf(file: string): string { return (file.match(/^(T-\d+(?:\.\d+)?)/) || ['', ''])[1]; }
export function listTicketFiles(dir: string): string[] {
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => TICKET_FILE.test(f)).sort() : [];
}
/** Exact id match: `T-007` finds `T-007-slug.md` but not `T-0071-x.md` or `T-007.1-x.md`. */
export function findTicketFile(dir: string, id: string): string | undefined {
  return listTicketFiles(dir).find((f) => ticketIdOf(f) === id);
}
export function readTicketFile(dir: string, id: string): { file: string; text: string } | undefined {
  const name = findTicketFile(dir, id);
  return name ? { file: path.join(dir, name), text: fs.readFileSync(path.join(dir, name), 'utf8') } : undefined;
}
