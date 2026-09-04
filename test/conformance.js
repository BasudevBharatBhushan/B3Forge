'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const cli = path.join(root, 'bin', 'cli.js');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function runCli(args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
}

function assertIncludes(text, expected, source) {
  assert.ok(text.includes(expected), `${source} must include ${expected}`);
}

const manual = read('CLAUDE.md');
for (let section = 0; section <= 11; section++) {
  assertIncludes(manual, `## ${section}.`, 'CLAUDE.md');
}
assert.ok(!manual.includes('§12'), 'CLAUDE.md must not reference a nonexistent §12');

assertIncludes(manual, 'one row per in-flight ticket', 'CLAUDE.md');
assertIncludes(manual, 'Rewritten whole', 'CLAUDE.md');
assert.ok(
  !manual.includes('active-ticket ') && !manual.includes('`ai-workspace/active-ticket`'),
  'CLAUDE.md must reference the active-tickets registry, not the old singular pointer'
);
for (const relative of ['README.md', 'SETUP.md', '.agents/rules/rules.md']) {
  assertIncludes(read(relative).toLowerCase(), 'one row per in-flight ticket', relative);
}
assertIncludes(read('ai-workspace/active-tickets'), 'One row per in-flight ticket', 'active-tickets');

const moduleTemplate = read('.agents/templates/MODULE_TICKET_TEMPLATE.md');
assertIncludes(moduleTemplate, '## M7. Module-Level Acceptance', 'module ticket template');
assertIncludes(moduleTemplate, '| # | Tool | Case | Expected | Result |', 'module ticket template M7');

for (const relative of [
  '.claude/skills/testing/SKILL.md',
  '.claude/skills/refactor/SKILL.md',
  '.claude/skills/ui-responsiveness/SKILL.md',
]) {
  assert.ok(!read(relative).includes('§8'), `${relative} must not reference nonexistent §8`);
}

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'agentic-template-'));
try {
  const dryRun = runCli([fixture, '--dry-run', '--no-mcp', '--no-skill']);
  assert.strictEqual(dryRun.status, 0, dryRun.stderr || dryRun.stdout);
  assertIncludes(dryRun.stdout, 'CLAUDE.md', 'CLI dry-run output');
  assert.ok(!fs.existsSync(path.join(fixture, 'CLAUDE.md')), 'dry-run must not create files');

  for (const flag of ['--graph-path', '--server-name']) {
    const result = runCli([fixture, '--dry-run', flag]);
    assert.notStrictEqual(result.status, 0, `${flag} without a value must fail`);
    assertIncludes(result.stderr, 'requires', `${flag} error output`);
  }
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

console.log('Template conformance checks passed.');
