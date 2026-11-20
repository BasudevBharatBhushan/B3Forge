import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cleanup, exists, install, read, readState, run, tmp, writeFile, writeState } from './helpers';

after(cleanup);

const COMMENT = '# B3Forge installed files (managed by b3forge; removed on uninstall)';
const IGNORE = ['graphify-out/', 'temp/', 'tmp/', '.agentic/install-state.json', '.agentic/memory/', '.agentic/config.json'];
const lineFor = (rel: string): string => '/' + rel;
const linesOf = (dir: string): string[] => read(dir, '.gitignore').split(/\r?\n/);
const gitEnv = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
const git = (dir: string, args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', env: gitEnv });
const hasGit = spawnSync('git', ['--version']).status === 0;

test('install --gitignore lists every owned file under the managed comment', () => {
  const dir = tmp();
  writeFile(dir, 'LESSONS.md', 'mine\n');
  const r = install(dir, ['--gitignore']);
  assert.equal(r.status, 0, r.stderr);
  const lines = linesOf(dir);
  const owned = Object.keys(readState(dir).files);
  assert.ok(owned.length > 10);
  assert.ok(lines.includes(COMMENT));
  for (const rel of owned) assert.ok(lines.includes(lineFor(rel)), rel);
  assert.ok(!lines.includes('/LESSONS.md'), 'preserved user file must not be listed');
  assert.ok(lines.includes('/.claude/skills/ticket/SKILL.md'));
  // Grouped and sorted after the comment.
  const after = lines.slice(lines.indexOf(COMMENT) + 1).filter(Boolean);
  assert.deepEqual(after, owned.map(lineFor).sort());
  for (const l of lines) assert.ok(!l.includes('\\') || l === '', 'forward slashes only');
  assert.equal(readState(dir).components.gitignoreInstalledFiles, true);
});

test('install --gitignore lists the CLAUDE.agentic.md companion, not the user CLAUDE.md', () => {
  const dir = tmp();
  writeFile(dir, 'CLAUDE.md', 'mine\n');
  assert.equal(install(dir, ['--gitignore']).status, 0);
  const lines = linesOf(dir);
  assert.ok(lines.includes('/CLAUDE.agentic.md'));
  assert.ok(!lines.includes('/CLAUDE.md'));
});

test('install without the flag adds no per-file lines', () => {
  const dir = tmp();
  assert.equal(install(dir).status, 0);
  const lines = linesOf(dir);
  assert.ok(!lines.includes(COMMENT));
  assert.ok(!lines.some((l) => l.startsWith('/')));
  assert.equal(readState(dir).components.gitignoreInstalledFiles, false);
  assert.match(run(['status', dir]).stdout, /Gitignore installed files: off/);
});

test('update keeps honoring the persisted choice and re-syncs', () => {
  const dir = tmp();
  assert.equal(install(dir, ['--gitignore']).status, 0);
  // Simulate a file B3Forge no longer owns (record dropped) and one it newly owns (line missing).
  const state = readState(dir);
  delete state.files['LESSONS.md'];
  (state.managedConfiguration.gitignore as { lines: string[] }).lines.push('/legacy/old.md');
  writeState(dir, state);
  fs.appendFileSync(path.join(dir, '.gitignore'), '/legacy/old.md\n');
  fs.writeFileSync(path.join(dir, '.gitignore'), read(dir, '.gitignore').replace('/AGENTS.md\n', ''));
  const r = run(['update', dir, '--no-mcp']);
  assert.equal(r.status, 0, r.stderr);
  const lines = linesOf(dir);
  assert.ok(!lines.includes('/legacy/old.md'));
  assert.ok(!lines.includes('/LESSONS.md'), 'dropped record loses its line');
  assert.ok(lines.includes('/AGENTS.md'), 'missing line re-added');
  assert.match(r.stdout, /REMOVE\s+\.gitignore — \/legacy\/old\.md/);
  assert.equal(readState(dir).components.gitignoreInstalledFiles, true);
  assert.match(run(['status', dir]).stdout, /Gitignore installed files: on/);
  assert.equal(JSON.parse(run(['status', dir, '--json']).stdout).gitignoreInstalledFiles, true);
});

test('update --gitignore turns it on for an install made without it', () => {
  const dir = tmp();
  assert.equal(install(dir).status, 0);
  assert.equal(run(['update', dir, '--no-mcp', '--gitignore']).status, 0);
  assert.ok(linesOf(dir).includes(COMMENT));
  assert.ok(linesOf(dir).includes('/AGENTS.md'));
  // Old state files without the field mean off.
  const state = readState(dir); delete state.components.gitignoreInstalledFiles; writeState(dir, state);
  assert.match(run(['status', dir]).stdout, /Gitignore installed files: off/);
});

test('update --no-gitignore removes per-file lines, keeps IGNORE and user lines', () => {
  const dir = tmp();
  writeFile(dir, '.gitignore', 'node_modules/\n/my-own\n');
  assert.equal(install(dir, ['--gitignore']).status, 0);
  const r = run(['update', dir, '--no-mcp', '--no-gitignore']);
  assert.equal(r.status, 0, r.stderr);
  const lines = linesOf(dir);
  assert.ok(!lines.includes(COMMENT));
  assert.ok(!lines.some((l) => l.startsWith('/') && l !== '/my-own'));
  for (const l of [...IGNORE, 'node_modules/', '/my-own']) assert.ok(lines.includes(l), l);
  assert.equal(readState(dir).components.gitignoreInstalledFiles, false);
  // Persisted: a plain update does not bring them back.
  run(['update', dir, '--no-mcp']);
  assert.ok(!linesOf(dir).includes(COMMENT));
});

test('uninstall removes every managed line and keeps the user lines', () => {
  const dir = tmp();
  writeFile(dir, '.gitignore', 'node_modules/\n/my-own\n');
  assert.equal(install(dir, ['--gitignore']).status, 0);
  const r = run(['uninstall', dir, '--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(linesOf(dir).filter(Boolean), ['node_modules/', '/my-own']);
});

test('install --gitignore --dry-run shows ADD lines and writes nothing', () => {
  const dir = tmp();
  const r = install(dir, ['--gitignore', '--dry-run']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ADD\s+\.gitignore — # B3Forge installed files/);
  assert.match(r.stdout, /ADD\s+\.gitignore — \/AGENTS\.md/);
  assert.ok(!exists(dir, '.gitignore'));
  assert.ok(!exists(dir, '.agentic/install-state.json'));
});

test('already-tracked owned files get a NOTE and a git rm --cached hint, never run', { skip: !hasGit && 'git not on PATH' }, () => {
  const dir = tmp();
  assert.equal(install(dir).status, 0);
  assert.equal(git(dir, ['init', '-q']).status, 0);
  assert.equal(git(dir, ['add', '-f', 'AGENTS.md', 'LESSONS.md']).status, 0);
  assert.equal(git(dir, ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'x']).status, 0);
  const r = run(['update', dir, '--no-mcp', '--gitignore']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /NOTE: \.gitignore does not untrack files already in git/);
  assert.match(r.stdout, /git rm --cached -- AGENTS\.md LESSONS\.md/);
  assert.equal(git(dir, ['ls-files', '--', 'AGENTS.md']).stdout.trim(), 'AGENTS.md', 'still tracked');
});

test('no NOTE outside a git repository', () => {
  const dir = tmp();
  const r = install(dir, ['--gitignore']);
  assert.ok(!/NOTE:/.test(r.stdout));
});
