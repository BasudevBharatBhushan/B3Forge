import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cleanup, exists, install, listFiles, read, readState, root, run, sha, tmp, writeFile } from './helpers';

after(cleanup);

test('--help and --version succeed', () => {
  const h = run(['--help']);
  assert.equal(h.status, 0);
  assert.match(h.stdout, /Usage: agentic-init/);
  const v = run(['--version']);
  assert.equal(v.status, 0);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version: string };
  assert.equal(v.stdout.trim(), pkg.version);
});

test('unknown flag, profile, harness, and bad port fail with exit 1', () => {
  const dir = tmp();
  for (const bad of [['--bogus'], ['--profile', 'nope'], ['--harness', 'nope'], ['--port', '99999'], ['--format', 'xml']]) {
    const r = run([dir, '--dry-run', ...bad]);
    assert.equal(r.status, 1, bad.join(' '));
    assert.match(r.stderr, /^error: /);
  }
});

test('nonexistent target fails', () => {
  const r = run([path.join(tmp(), 'does-not-exist'), '--dry-run']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /target directory does not exist/);
});

test('refuses to scaffold the template into itself', () => {
  const r = run([root, '--dry-run']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refusing to scaffold the template into itself/);
});

test('--dry-run reports CLAUDE.md and writes nothing', () => {
  const dir = tmp();
  const r = run([dir, '--dry-run', '--no-mcp', '--no-skill']);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.ok(r.stdout.includes('CLAUDE.md'));
  assert.match(r.stdout, /Dry run/);
  assert.ok(!exists(dir, 'CLAUDE.md'));
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('--graph-path and --server-name without a value fail', () => {
  const dir = tmp();
  for (const flag of ['--graph-path', '--server-name']) {
    const r = run([dir, '--dry-run', flag]);
    assert.notEqual(r.status, 0, `${flag} without a value must fail`);
    assert.ok(r.stderr.includes('requires'), `${flag} error output`);
  }
});

test('install creates template files and install-state.json', () => {
  const dir = tmp();
  const r = install(dir);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['CLAUDE.md', 'AGENTS.md', 'LESSONS.md', 'SETUP.md', '.claude', 'ai-workspace']) assert.ok(exists(dir, f), f);
  const state = readState(dir);
  assert.equal(state.schemaVersion, 1);
  assert.equal(state.profile, 'core');
  assert.deepEqual(state.harnesses, ['claude']);
  assert.ok(Object.keys(state.files).includes('CLAUDE.md'));
  // recorded fingerprints match what is on disk
  for (const [rel, rec] of Object.entries(state.files)) {
    assert.equal(rec.installedSha256, sha(fs.readFileSync(path.join(dir, rel))), rel);
  }
  assert.ok(!exists(dir, '.mcp.json'), '--no-mcp must not create .mcp.json');
});

test('install adds managed .gitignore lines', () => {
  const dir = tmp();
  install(dir);
  const ignore = read(dir, '.gitignore').split(/\r?\n/);
  for (const line of ['graphify-out/', '.agentic/install-state.json', '.agentic/memory/']) assert.ok(ignore.includes(line), line);
});

test('install never overwrites a pre-existing file', () => {
  const dir = tmp();
  writeFile(dir, 'LESSONS.md', 'my own lessons\n');
  writeFile(dir, 'AGENTS.md', 'my agents\n');
  const r = install(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'LESSONS.md'), 'my own lessons\n');
  assert.equal(read(dir, 'AGENTS.md'), 'my agents\n');
  assert.match(r.stdout, /PRESERVE\s+LESSONS\.md/);
  const state = readState(dir);
  assert.ok(!('LESSONS.md' in state.files), 'unowned file must not be tracked');
});

test('pre-existing CLAUDE.md is kept; template goes to CLAUDE.agentic.md', () => {
  const dir = tmp();
  writeFile(dir, 'CLAUDE.md', 'project rules\n');
  const r = install(dir);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(read(dir, 'CLAUDE.md'), 'project rules\n');
  assert.ok(exists(dir, 'CLAUDE.agentic.md'));
  assert.ok('CLAUDE.agentic.md' in readState(dir).files);
});

test('re-running install is idempotent (everything SKIP)', () => {
  const dir = tmp();
  install(dir);
  const before = listFiles(dir);
  const r = install(dir);
  assert.equal(r.status, 0);
  assert.ok(!/^CREATE/m.test(r.stdout) && !/^UPDATE/m.test(r.stdout));
  assert.deepEqual(listFiles(dir), before);
});

test('profile minimal installs no hooks and no MCP config', () => {
  const dir = tmp();
  const r = run([dir, '--profile', 'minimal']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!listFiles(dir).some((f) => f.startsWith('.agentic/hooks/')));
  assert.ok(!exists(dir, '.mcp.json'));
  const state = readState(dir);
  assert.equal(state.profile, 'minimal');
  assert.equal(state.components.hooks, false);
  assert.equal(state.components.graphifyMcp, false);
});

test('profile core installs no hooks', () => {
  const dir = tmp();
  install(dir);
  assert.ok(!listFiles(dir).some((f) => f.startsWith('.agentic/hooks/')));
});

test('profile strict without --enable-hooks refuses (exit 1) and writes nothing', () => {
  const dir = tmp();
  const r = run([dir, '--profile', 'strict', '--no-mcp']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /strict profile requires --enable-hooks/);
  assert.deepEqual(fs.readdirSync(dir), []);
});

test('profile strict with --enable-hooks installs hooks', () => {
  const dir = tmp();
  const r = run([dir, '--profile', 'strict', '--enable-hooks', '--no-mcp']);
  assert.equal(r.status, 0, r.stderr);
  const hooks = listFiles(dir).filter((f) => f.startsWith('.agentic/hooks/'));
  assert.ok(hooks.length > 0);
  assert.ok(hooks.some((f) => f.endsWith('.js')));
  assert.equal(readState(dir).components.hooks, true);
});

test('--harness copilot installs .github but never the CI workflow', () => {
  const dir = tmp();
  const r = install(dir, ['--harness', 'copilot']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(exists(dir, '.github/copilot-instructions.md'));
  assert.ok(!exists(dir, '.github/workflows/ci.yml'));
  assert.ok(!listFiles(dir).some((f) => f.startsWith('.github/workflows/')));
  assert.ok(!Object.keys(readState(dir).files).some((f) => f.startsWith('.github/workflows/')));
});

test('--all-harnesses installs every adapter directory', () => {
  const dir = tmp();
  const r = install(dir, ['--all-harnesses']);
  assert.equal(r.status, 0, r.stderr);
  for (const f of ['.claude', '.codex', '.cursor', '.github']) assert.ok(exists(dir, f), f);
  assert.ok(!exists(dir, '.github/workflows/ci.yml'));
});
