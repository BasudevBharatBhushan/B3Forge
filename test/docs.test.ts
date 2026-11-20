import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { root } from './helpers';

const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');

const MAX_CLAUDE_MD_BYTES = 7168;

test('CLAUDE.md stays within its byte budget', () => {
  const bytes = fs.statSync(path.join(root, 'CLAUDE.md')).size;
  assert.ok(bytes <= MAX_CLAUDE_MD_BYTES, `CLAUDE.md is ${bytes} bytes, budget ${MAX_CLAUDE_MD_BYTES}`);
});

test('every skill named in CLAUDE.md exists', () => {
  const manual = read('CLAUDE.md');
  const names = new Set<string>();
  for (const match of manual.matchAll(/`\/([a-z][a-z0-9-]*)`/g)) names.add(match[1]);
  assert.ok(names.size >= 9, `expected to parse skill names, found ${[...names].join(', ')}`);
  for (const name of names) {
    assert.ok(fs.existsSync(path.join(root, '.claude/skills', name, 'SKILL.md')), `missing skill /${name}`);
  }
});

test('CLAUDE.md keeps the hard-rule keywords', () => {
  const manual = read('CLAUDE.md');
  const keywords = [
    'approved ticket',
    '`impl-small`',
    '`impl-mid`',
    '`model` override',
    'Partition by file',
    'read every diff',
    'explicit request',
    'Max 3 fix cycles',
    'push needs approval',
    'Never CRUD a real database',
    'Never hardcode credentials',
  ];
  for (const keyword of keywords) {
    assert.ok(manual.includes(keyword), `CLAUDE.md must contain "${keyword}"`);
  }
});

test('doc paths referenced in CLAUDE.md exist', () => {
  const manual = read('CLAUDE.md');
  // Short forms (backend.md, workflows/workflow.md) resolve against these bases.
  const bases = ['', '.agents/rules', '.agents/templates', '.agents'];
  const exists = (p: string): boolean => bases.some((b) => fs.existsSync(path.join(root, b, p)));
  const seen = new Set<string>();
  for (const match of manual.matchAll(/`([^`\s]+)`/g)) {
    const ref = match[1];
    const isDoc = ref.endsWith('.md') || /^(\.agents|ai-workspace)\//.test(ref);
    // Skip placeholders (NNN_...), globs, and files the project creates later.
    if (!isDoc || ref.includes('NNN') || ref.includes('*') || seen.has(ref)) continue;
    seen.add(ref);
    assert.ok(exists(ref), `CLAUDE.md references missing path: ${ref}`);
  }
  assert.ok(seen.size >= 10, 'expected to find doc paths in CLAUDE.md');
});

test('the /ticket skill owns the active-tickets registry rules', () => {
  const skill = read('.claude/skills/ticket/SKILL.md');
  assert.ok(skill.includes('One row per in-flight ticket'));
  assert.ok(skill.includes('Rewritten whole'));
  assert.ok(!skill.includes('`ai-workspace/active-ticket`'));
});

test('every SKILL.md has frontmatter matching its folder', () => {
  const dir = path.join(root, '.claude/skills');
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const text = read(`.claude/skills/${entry.name}/SKILL.md`);
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
    assert.ok(front, `${entry.name}: missing frontmatter`);
    const name = /^name:\s*(.+)$/m.exec(front[1]);
    const description = /^description:\s*(.+)$/m.exec(front[1]);
    assert.equal(name?.[1].trim(), entry.name, `${entry.name}: name must match folder`);
    assert.ok(description && description[1].trim().length > 0, `${entry.name}: empty description`);
  }
});

test('docs agree on the active-tickets registry wording', () => {
  for (const relative of ['README.md', 'SETUP.md', '.agents/rules/rules.md']) {
    assert.ok(read(relative).toLowerCase().includes('one row per in-flight ticket'), relative);
  }
  assert.ok(read('ai-workspace/active-tickets').includes('One row per in-flight ticket'));
});

test('module ticket template has the M7 acceptance section', () => {
  const t = read('.agents/templates/MODULE_TICKET_TEMPLATE.md');
  assert.ok(t.includes('## M7. Module-Level Acceptance'));
  assert.ok(t.includes('| # | Tool | Case | Expected | Result |'));
});

test('skills do not reference nonexistent section 8', () => {
  for (const relative of [
    '.claude/skills/testing/SKILL.md',
    '.claude/skills/refactor/SKILL.md',
    '.claude/skills/ui-responsiveness/SKILL.md',
  ]) {
    assert.ok(!read(relative).includes('§8'), `${relative} must not reference nonexistent §8`);
  }
});

test('behavior book: README, B7 template section, no PHASE 3 placeholders', () => {
  assert.ok(fs.existsSync(path.join(root, 'ai-workspace/behavior/README.md')));
  assert.ok(read('.agents/templates/TICKET_TEMPLATE.md').includes('## B7. Behavior changes'));
  assert.ok(read('.agents/templates/EXAMPLE_TICKET.md').includes('## B7. Behavior changes'));
  for (const skill of ['close-ticket', 'discovery']) {
    assert.ok(!read(`.claude/skills/${skill}/SKILL.md`).includes('PHASE 3'), `${skill} still has a PHASE 3 placeholder`);
  }
});
