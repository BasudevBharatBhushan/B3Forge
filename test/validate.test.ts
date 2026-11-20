import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanup, root, run, tmp, writeFile } from './helpers';

after(cleanup);

// The parser is compiled into dist/ (test/ is a separate TS project and cannot import src/).
interface Parsed {
  header: Record<string, { value: string }>;
  b7: { none: number | null; entries: Array<{ kind: string; rule: string; area: string | null; line: number }> } | null;
}
const { parseBehaviorArea, parseRegistry, parseTicket } = require(path.join(root, 'dist', 'ticket', 'parse.js')) as {
  parseBehaviorArea(text: string): Array<{ name: string; hasWhen: boolean; hasThen: boolean }>;
  parseRegistry(text: string): Array<{ claimed: string[] }>;
  parseTicket(text: string): Parsed;
};

const fixtures = path.join(root, 'test', 'fixtures', 'validate');
const good = path.join(fixtures, 'good');

test('good fixture validates clean', () => {
  const r = run(['validate', good]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 errors, 0 warnings/);
});

test('validate --ticket on a good ticket exits 0', () => {
  assert.equal(run(['validate', good, '--ticket', 'T-002']).status, 0);
});

test('--ticket with an unknown id exits 2', () => {
  const r = run(['validate', good, '--ticket', 'T-999']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ticket not found: T-999/);
});

test('a target without ai-workspace exits 2', () => {
  assert.equal(run(['validate', tmp()]).status, 2);
});

// One failing fixture per plan check: [fixture dir, expected exit, severity, message substring].
const bad: Array<[string, number, string, string]> = [
  ['header-missing-field', 1, 'error', 'missing header field "Date"'],
  ['header-bad-status', 1, 'error', 'invalid Status "DONE"'],
  ['header-bad-type', 1, 'error', 'invalid Type "cleanup"'],
  ['size-ticket', 1, 'error', 'ticket is 221 lines (max 170)'],
  ['size-part-a', 1, 'error', 'Part A is 31 lines (max 25)'],
  ['subtask-agent', 1, 'error', 'Agent "impl-large"'],
  ['completed-unfinished', 1, 'error', 'COMPLETED ticket has unfinished subtask 2'],
  ['completed-in-registry', 1, 'error', 'COMPLETED ticket T-001 is still in active-tickets'],
  ['completed-b7-missing-from-book', 1, 'error', 'ADDED rule "Login lockout" is not in behavior/auth.md'],
  ['completed-b7-removed-still-present', 1, 'error', 'removes rule "Login lockout" but it is still in behavior/auth.md'],
  ['b7-missing', 1, 'error', 'missing section "## B7. Behavior changes"'],
  ['b7-none-on-feature', 1, 'error', 'only allowed for refactor and chore'],
  ['registry-missing-ticket', 1, 'error', 'T-009 points to a missing ticket file'],
  ['registry-status-mismatch', 1, 'error', 'status mismatch'],
  ['registry-overlap', 0, 'warning', 'both claim "src/a.ts"'],
  ['behavior-missing-then', 1, 'error', 'has no THEN line'],
  ['behavior-duplicate-rule', 1, 'error', 'duplicate rule "Login lockout"'],
];
for (const [name, status, severity, message] of bad) {
  test(`bad/${name}`, () => {
    const r = run(['validate', path.join(fixtures, 'bad', name)]);
    assert.equal(r.status, status, r.stdout + r.stderr);
    const line = r.stdout.split('\n').find((l) => l.includes(message));
    assert.ok(line, `expected "${message}" in:\n${r.stdout}`);
    assert.match(line, new RegExp(`^\\S+:\\d+  ${severity}  `));
  });
}

test('every bad fixture directory has a test', () => {
  assert.deepEqual(fs.readdirSync(path.join(fixtures, 'bad')).sort(), bad.map((b) => b[0]).sort());
});

test('EXAMPLE_TICKET.md validates clean in a project (not COMPLETED, so no book needed)', () => {
  const dir = tmp();
  writeFile(dir, 'ai-workspace/tickets/T-042-invoice.md', fs.readFileSync(path.join(root, '.agents/templates/EXAMPLE_TICKET.md'), 'utf8'));
  const r = run(['validate', dir]);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /0 errors, 0 warnings/);
});

test('the template repo itself validates clean', () => {
  assert.equal(run(['validate', root]).status, 0);
});

test('validate emits JSON with --json', () => {
  const r = run(['validate', path.join(fixtures, 'bad', 'header-bad-status'), '--json']);
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout) as { errors: number; problems: Array<{ line: number }> };
  assert.equal(out.errors, 1);
  assert.equal(out.problems[0].line, 3);
});

test('parser ignores HTML comments and reads B7 entries', () => {
  const t = parseTicket('# T-1: x\n\n**Status:** TODO <!-- a -->\n\n## B7. Behavior changes\n<!-- `None — no behavior change` [ ] -->\n**Area:** auth\n### CHANGED Rule: Foo\n- WHEN a\n- THEN b\n');
  assert.equal(t.header.Status.value, 'TODO');
  assert.equal(t.b7?.none, null);
  assert.deepEqual(t.b7?.entries.map((e) => [e.kind, e.rule, e.area, e.line]), [['CHANGED', 'Foo', 'auth', 8]]);
});

test('parseRegistry skips the placeholder and splits claimed files', () => {
  assert.equal(parseRegistry('| Ticket | Path | Status | Current subtask | Claimed files |\n|---|---|---|---|---|\n| — | — | no tickets in flight | — | — |\n').length, 0);
  const rows = parseRegistry('| T-007 | ai-workspace/tickets/T-007-a.md | IN_PROGRESS | 2 | `a.ts`, `b.ts`, T-001 (child 1/2) |\n');
  assert.deepEqual(rows[0].claimed, ['a.ts', 'b.ts']);
});

test('parseBehaviorArea records WHEN/THEN presence', () => {
  const rules = parseBehaviorArea('# Area: X\n\n## Rule: A\n- WHEN x\n\n## Rule: B\n- WHEN y\n- THEN z\n');
  assert.deepEqual(rules.map((r) => [r.name, r.hasWhen, r.hasThen]), [['A', true, false], ['B', true, true]]);
});

function hook(name: string, cwd: string, input = ''): { level: string; message: string } {
  const r = spawnSync(process.execPath, [path.join(root, '.agentic', 'hooks', `${name}.js`)], { cwd, input, encoding: 'utf8' });
  return JSON.parse(r.stdout) as { level: string; message: string };
}

test('ticket-state hook flags a COMPLETED ticket left in the registry and keeps the {level,message} shape', () => {
  const r = hook('ticket-state', path.join(fixtures, 'bad', 'completed-in-registry'));
  assert.equal(r.level, 'warn');
  assert.match(r.message, /T-001: COMPLETED ticket is still in active-tickets/);
});

test('ticket-state hook flags a registry row whose status disagrees with the ticket', () => {
  assert.match(hook('ticket-state', path.join(fixtures, 'bad', 'registry-status-mismatch')).message, /registry says AWAITING_TEST, ticket says IN_PROGRESS/);
});

test('ticket-state hook is quiet on a consistent project', () => {
  const dir = tmp();
  writeFile(dir, 'ai-workspace/active-tickets', '| Ticket | Path | Status | Current subtask | Claimed files |\n|---|---|---|---|---|\n| — | — | no tickets in flight | — | — |\n');
  assert.equal(hook('ticket-state', dir).level, 'info');
});

const closing = (name: string): string => path.join(fixtures, 'closing', name);

test('--closing passes a fully merged ticket even though its registry row still exists', () => {
  assert.equal(run(['validate', closing('good'), '--ticket', 'T-001', '--closing']).status, 0);
});

test('--closing fails on an open subtask', () => {
  const r = run(['validate', closing('open-subtask'), '--ticket', 'T-001', '--closing']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /unfinished subtask 2/);
});

test('--closing fails when B7 is not merged into the book yet', () => {
  const r = run(['validate', closing('b7-not-merged'), '--ticket', 'T-001', '--closing']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /is not in behavior\/auth\.md/);
});

test('without --closing the same in-flight ticket is not held to completion checks', () => {
  assert.equal(run(['validate', closing('b7-not-merged'), '--ticket', 'T-001']).status, 0);
});

test('legacy 0.2 ticket gets one warning, B7 checks skipped, exit 0', () => {
  const r = run(['validate', path.join(fixtures, 'legacy', 'good')]);
  assert.equal(r.status, 0, r.stdout);
  const lines = r.stdout.split('\n').filter((l) => l.includes('legacy ticket (pre-0.3 format): B7/behavior-book checks skipped'));
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^ai-workspace\/tickets\/T-001-old\.md:1  warning  /);
  assert.doesNotMatch(r.stdout, /  error  /);
});

test('legacy tickets still get the non-B7 checks', () => {
  const r = run(['validate', path.join(fixtures, 'legacy', 'bad-agent')]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Agent "impl-huge"/);
});

test('validate bad usage exits 2: unknown flag, extra positional, --closing without --ticket', () => {
  assert.equal(run(['validate', good, '--bogus']).status, 2);
  assert.equal(run(['validate', good, 'extra']).status, 2);
  assert.equal(run(['validate', good, '--closing']).status, 2);
  assert.equal(run(['validate', good, '--ticket']).status, 2);
  assert.equal(run(['scan', good, '--bogus']).status, 1, 'other commands keep exit 1');
});
