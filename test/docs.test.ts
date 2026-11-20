import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { root } from './helpers';

const read = (relative: string): string => fs.readFileSync(path.join(root, relative), 'utf8');

test('CLAUDE.md has sections 0-11 and no nonexistent section 12', () => {
  const manual = read('CLAUDE.md');
  for (let section = 0; section <= 11; section++) {
    assert.ok(manual.includes(`## ${section}.`), `CLAUDE.md must include ## ${section}.`);
  }
  assert.ok(!manual.includes('§12'), 'CLAUDE.md must not reference a nonexistent §12');
});

test('CLAUDE.md describes the active-tickets registry', () => {
  const manual = read('CLAUDE.md');
  assert.ok(manual.includes('one row per in-flight ticket'));
  assert.ok(manual.includes('Rewritten whole'));
  assert.ok(
    !manual.includes('active-ticket ') && !manual.includes('`ai-workspace/active-ticket`'),
    'CLAUDE.md must reference the active-tickets registry, not the old singular pointer'
  );
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
