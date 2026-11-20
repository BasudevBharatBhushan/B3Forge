import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root } from './helpers';

const { isLocalOnly, desired } = require(path.join(root, 'dist', 'plan.js')) as {
  isLocalOnly(relative: string): boolean;
  desired(options: { harnesses: Set<string>; profile: string }): string[];
};

test('isLocalOnly excludes worktrees and settings.local.json only', () => {
  assert.ok(isLocalOnly('.claude/worktrees/x/file'));
  assert.ok(isLocalOnly('.claude/worktrees'));
  assert.ok(isLocalOnly('.claude/settings.local.json'));
  assert.ok(!isLocalOnly('.claude/settings.json'));
  assert.ok(!isLocalOnly('.claude/skills/ticket/SKILL.md'));
  assert.ok(!isLocalOnly('.claude/worktrees-docs/readme.md'));
});

test('desired() never lists local-only files', () => {
  const files = desired({ harnesses: new Set(['claude']), profile: 'core' });
  assert.ok(files.some((f) => f.startsWith('.claude/skills/')));
  assert.deepEqual(files.filter(isLocalOnly), []);
});

function secretHook(input: string): { level: string } {
  const r = spawnSync(process.execPath, [path.join(root, '.agentic', 'hooks', 'secret-warning.js')], { input, encoding: 'utf8' });
  return JSON.parse(r.stdout) as { level: string };
}

test('secret-warning hook flags quoted JSON keys and plain assignments, not prose', () => {
  assert.equal(secretHook('{"api_key": "abcdefghijklmnop1234"}').level, 'warn');
  assert.equal(secretHook('token = abcdefghijklmnop1234').level, 'warn');
  assert.equal(secretHook('-----BEGIN RSA PRIVATE KEY-----').level, 'warn');
  assert.equal(secretHook('set the api_key in your environment').level, 'info');
});

test('hook secret pattern is identical to scan AGT004', () => {
  const norm = (s: string): string => s.replace(/\\"/g, '"');
  const hook = fs.readFileSync(path.join(root, 'src/hooks/secret-warning.ts'), 'utf8').match(/const SECRET = \/(.+)\/i;/);
  const scan = fs.readFileSync(path.join(root, 'src/commands/scan.ts'), 'utf8').match(/\['AGT004', \/(.+?)\/i,/);
  assert.ok(hook && scan);
  assert.equal(norm(hook[1]), norm(scan[1]));
});
