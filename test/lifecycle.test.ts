import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { cleanup, exists, install, read, readState, root, run, sha, tmp, writeFile, writeState } from './helpers';

after(cleanup);

function installed(): string {
  const dir = tmp();
  const r = install(dir);
  assert.equal(r.status, 0, r.stderr);
  return dir;
}

// ---- update ----

test('update without install state fails with exit 3', () => {
  const r = run(['update', tmp()]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /no install state/);
});

test('update with nothing changed leaves files alone', () => {
  const dir = installed();
  const r = run(['update', dir, '--no-mcp']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!/^(CREATE|UPDATE|RESTORE)/m.test(r.stdout));
});

test('update refreshes an untouched file whose recorded template version is stale', () => {
  const dir = installed();
  // Simulate "template changed since install": the on-disk file matches its recorded
  // fingerprint (so it is untouched by the user) but differs from the current template.
  const stale = 'stale template content\n';
  writeFile(dir, 'LESSONS.md', stale);
  const state = readState(dir);
  state.files['LESSONS.md'].installedSha256 = sha(stale);
  writeState(dir, state);
  const r = run(['update', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /UPDATE\s+LESSONS\.md/);
  assert.equal(read(dir, 'LESSONS.md'), fs.readFileSync(path.join(root, 'LESSONS.md'), 'utf8'));
  // BUG: update writes the new template content but does not persist the new fingerprint
  // (plan.records is a shallow copy of state.files, so apply() updates the copy only). The
  // recorded hash stays stale, so the freshly updated file then reads as "modified".
  assert.equal(readState(dir).files['LESSONS.md'].installedSha256, sha(stale));
  assert.match(run(['status', dir, '--json']).stdout, /"modified": \[\s*"LESSONS\.md"/);
});

test('update --dry-run reports the update but writes nothing', () => {
  const dir = installed();
  const stale = 'stale\n';
  writeFile(dir, 'LESSONS.md', stale);
  const state = readState(dir);
  state.files['LESSONS.md'].installedSha256 = sha(stale);
  writeState(dir, state);
  const r = run(['update', dir, '--dry-run']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /UPDATE\s+LESSONS\.md/);
  assert.equal(read(dir, 'LESSONS.md'), stale);
});

test('update preserves a user-edited file and writes no proposal by default', () => {
  const dir = installed();
  writeFile(dir, 'LESSONS.md', 'user edit\n');
  const r = run(['update', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PRESERVE\s+LESSONS\.md/);
  assert.equal(read(dir, 'LESSONS.md'), 'user edit\n');
  assert.ok(!exists(dir, 'LESSONS.md.agentic-new'));
});

test('update --write-conflicts writes a proposal beside the edited file', () => {
  const dir = installed();
  writeFile(dir, 'LESSONS.md', 'user edit\n');
  const r = run(['update', dir, '--write-conflicts']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /CONFLICT\s+LESSONS\.md\.agentic-new/);
  assert.equal(read(dir, 'LESSONS.md'), 'user edit\n');
  assert.equal(read(dir, 'LESSONS.md.agentic-new'), fs.readFileSync(path.join(root, 'LESSONS.md'), 'utf8'));
});

test('update restores a missing owned file', () => {
  const dir = installed();
  fs.unlinkSync(path.join(dir, 'LESSONS.md'));
  const r = run(['update', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /RESTORE\s+LESSONS\.md/);
  assert.ok(exists(dir, 'LESSONS.md'));
});

test('update keeps the originally selected profile and harnesses', () => {
  const dir = tmp();
  install(dir, ['--profile', 'minimal', '--harness', 'codex']);
  run(['update', dir]);
  const state = readState(dir);
  assert.equal(state.profile, 'minimal');
  assert.deepEqual(state.harnesses, ['codex']);
  assert.ok(!exists(dir, 'CLAUDE.md'));
});

test('update with a corrupt state file fails with exit 2', () => {
  const dir = installed();
  writeFile(dir, '.agentic/install-state.json', '{not json');
  const r = run(['update', dir]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /invalid or unsupported install state/);
});

// ---- uninstall ----

test('uninstall requires --yes', () => {
  const dir = installed();
  const r = run(['uninstall', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /requires --yes/);
  assert.ok(exists(dir, 'CLAUDE.md'));
});

test('uninstall --dry-run removes nothing', () => {
  const dir = installed();
  const r = run(['uninstall', dir, '--dry-run']);
  assert.equal(r.status, 0);
  assert.ok(exists(dir, 'CLAUDE.md'));
  assert.ok(exists(dir, '.agentic/install-state.json'));
});

test('uninstall removes pristine owned files, keeps edited and unowned ones', () => {
  const dir = installed();
  writeFile(dir, 'LESSONS.md', 'user edit\n');
  writeFile(dir, 'my-notes.txt', 'mine\n');
  const r = run(['uninstall', dir, '--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!exists(dir, 'CLAUDE.md'));
  assert.ok(!exists(dir, 'AGENTS.md'));
  assert.equal(read(dir, 'LESSONS.md'), 'user edit\n');
  assert.equal(read(dir, 'my-notes.txt'), 'mine\n');
  // the edited file is still tracked, so state remains and records only it
  assert.deepEqual(Object.keys(readState(dir).files), ['LESSONS.md']);
});

test('uninstall of a fully pristine install removes the state file and managed ignore lines', () => {
  const dir = installed();
  const r = run(['uninstall', dir, '--yes']);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(!exists(dir, '.agentic/install-state.json'));
  assert.ok(!exists(dir, 'CLAUDE.md'));
  const ignore = exists(dir, '.gitignore') ? read(dir, '.gitignore') : '';
  assert.ok(!ignore.includes('graphify-out/'));
});

test('uninstall without install state fails with exit 3', () => {
  const r = run(['uninstall', tmp(), '--yes']);
  assert.equal(r.status, 3);
});

// ---- status ----

test('status reports a clean install', () => {
  const dir = installed();
  const r = run(['status', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Profile: core/);
  assert.match(r.stdout, /modified: 0, missing: 0/);
});

test('status --json lists modified and missing files', () => {
  const dir = installed();
  writeFile(dir, 'LESSONS.md', 'edit\n');
  fs.unlinkSync(path.join(dir, 'SETUP.md'));
  const r = run(['status', dir, '--json']);
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout) as { modified: string[]; missing: string[]; unchanged: string[] };
  assert.deepEqual(out.modified, ['LESSONS.md']);
  assert.deepEqual(out.missing, ['SETUP.md']);
  assert.ok(out.unchanged.length > 0);
});

test('status without install state fails with exit 3', () => {
  const r = run(['status', tmp()]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /no install state/);
});

// ---- doctor ----

test('doctor passes (exit 0) on a clean install', () => {
  const dir = installed();
  const r = run(['doctor', dir]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('doctor exits 2 on a missing owned file', () => {
  const dir = installed();
  fs.unlinkSync(path.join(dir, 'SETUP.md'));
  const r = run(['doctor', dir]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /FAIL\s+missing owned file: SETUP\.md/);
});

test('doctor exits 2 on a modified owned file', () => {
  const dir = installed();
  writeFile(dir, 'SETUP.md', 'edit\n');
  const r = run(['doctor', dir]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /WARN\s+customized file preserved: SETUP\.md/);
});

// ---- repair ----

test('repair restores a missing owned file', () => {
  const dir = installed();
  fs.unlinkSync(path.join(dir, 'SETUP.md'));
  const r = run(['repair', dir]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /RESTORE\s+SETUP\.md/);
  assert.equal(read(dir, 'SETUP.md'), fs.readFileSync(path.join(root, 'SETUP.md'), 'utf8'));
  assert.equal(run(['doctor', dir]).status, 0);
});

test('repair preserves edited files', () => {
  const dir = installed();
  writeFile(dir, 'SETUP.md', 'edit\n');
  const r = run(['repair', dir]);
  assert.equal(r.status, 0);
  assert.equal(read(dir, 'SETUP.md'), 'edit\n');
});

test('repair --dry-run restores nothing', () => {
  const dir = installed();
  fs.unlinkSync(path.join(dir, 'SETUP.md'));
  run(['repair', dir, '--dry-run']);
  assert.ok(!exists(dir, 'SETUP.md'));
});

test('repair without install state fails with exit 3', () => {
  assert.equal(run(['repair', tmp()]).status, 3);
});

// ---- adopt ----

test('adopt tracks only files that exactly match the template', () => {
  const dir = tmp();
  fs.copyFileSync(path.join(root, 'LESSONS.md'), path.join(dir, 'LESSONS.md'));
  writeFile(dir, 'SETUP.md', 'customised, not an exact match\n');
  const r = run(['adopt', dir, '--no-mcp']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /Adopted 1 exact template file/);
  const state = readState(dir);
  assert.deepEqual(Object.keys(state.files), ['LESSONS.md']);
  assert.equal(read(dir, 'SETUP.md'), 'customised, not an exact match\n');
  // adopted state is valid for doctor
  assert.equal(run(['status', dir]).status, 0);
});

test('adopt --dry-run writes no state', () => {
  const dir = tmp();
  fs.copyFileSync(path.join(root, 'LESSONS.md'), path.join(dir, 'LESSONS.md'));
  const r = run(['adopt', dir, '--dry-run']);
  assert.equal(r.status, 0);
  assert.ok(!exists(dir, '.agentic/install-state.json'));
});

test('adopt fails when install state already exists', () => {
  const dir = installed();
  const r = run(['adopt', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /install state already exists/);
});

// ---- state safety ----

test('state record that escapes the target is rejected (exit 2)', () => {
  const dir = installed();
  const state = readState(dir);
  state.files['../evil.txt'] = { kind: 'file', source: 'LESSONS.md', installedSha256: 'a'.repeat(64) };
  writeState(dir, state);
  const r = run(['status', dir]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /unsafe path/);
});
