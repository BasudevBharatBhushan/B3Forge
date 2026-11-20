import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { BASE, IGNORE, IGNORE_COMMENT, ROOT, STATE } from './constants';
import { digest, json, present, safeRelative, stable, within } from './fs-safe';
import { statusOf } from './state';
import type { Action, FileRecord, InstallState, McpServerValue, Options } from './types';

/** Local, untracked content a dev checkout may contain under .claude/; never installed. */
export function isLocalOnly(relative: string): boolean {
  const clean = relative.replace(/\\/g, '/').replace(/^\.\//, '');
  return clean === '.claude/worktrees' || clean.startsWith('.claude/worktrees/') || clean === '.claude/settings.local.json';
}
function sourceFiles(relative: string, output: string[] = []): string[] {
  if (isLocalOnly(relative)) return output;
  const src = path.join(ROOT, relative); if (!present(src)) return output;
  if (fs.statSync(src).isFile()) { const clean = safeRelative(relative); if (clean !== STATE) output.push(clean); return output; }
  for (const name of fs.readdirSync(src)) sourceFiles(path.join(relative, name), output);
  return output;
}
export function desired(options: Options): string[] {
  const roots = [...BASE];
  if (options.harnesses.has('claude')) roots.push('.claude', 'CLAUDE.md');
  if (options.harnesses.has('codex')) roots.push('.codex');
  if (options.harnesses.has('cursor')) roots.push('.cursor');
  if (options.harnesses.has('copilot')) roots.push('.github');
  const files = new Set<string>(); for (const root of roots) for (const file of sourceFiles(root)) files.add(file);
  if (options.profile !== 'strict') for (const file of [...files]) if (file.startsWith('.agentic/hooks/')) files.delete(file);
  for (const file of [...files]) if (file.startsWith('.github/workflows/')) files.delete(file);
  return [...files].sort();
}
export function source(relative: string): Buffer { return fs.readFileSync(within(ROOT, relative)); }

export function commandExists(command: string): boolean { return spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command]).status === 0; }
function graphServer(options: Options): McpServerValue {
  return commandExists('uv')
    ? { command: 'uv', args: ['run', '--with', 'graphifyy', '--with', 'mcp', '-m', 'graphify.serve', options.graphPath] }
    : { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-m', 'graphify.serve', options.graphPath] };
}

export function plannedFiles(target: string, options: Options, existing: InstallState | null): { actions: Action[]; records: Record<string, FileRecord> } {
  const actions: Action[] = []; const records: Record<string, FileRecord> = existing ? { ...existing.files } : {};
  for (const relative of desired(options)) {
    const destination = within(target, relative); const content = source(relative); const incoming = digest(content); const owned = records[relative];
    if (!owned && relative === 'CLAUDE.md' && present(destination) && !present(within(target, 'CLAUDE.agentic.md'))) {
      actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: relative, content, reason: 'existing-project-claude-md' });
    } else if (!owned) actions.push(!present(destination) ? { op: 'write', relative, source: relative, content, reason: 'new-template-file' } : { op: 'preserve', relative, reason: 'existing-file-not-owned' });
    else if (statusOf(target, relative, owned) === 'missing') actions.push({ op: 'write', relative, source: owned.source, content, reason: 'missing-owned-file' });
    else if (statusOf(target, relative, owned) === 'modified') actions.push({ op: 'preserve', relative, content, reason: 'customized-file', conflict: options.writeConflicts });
    else if (owned.installedSha256 !== incoming) actions.push({ op: 'write', relative, source: owned.source, content, reason: 'template-update' });
    else actions.push({ op: 'skip', relative, reason: 'already-current' });
  }
  // An existing project CLAUDE.md is never managed. Its generated companion is, so include it
  // in future updates even though it is not a normal source-path destination.
  if (records['CLAUDE.agentic.md']) {
    const record = records['CLAUDE.agentic.md']; const content = source(record.source);
    const found = statusOf(target, 'CLAUDE.agentic.md', record);
    if (found === 'missing') actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'missing-owned-file' });
    else if (found === 'modified') actions.push({ op: 'preserve', relative: 'CLAUDE.agentic.md', content, reason: 'customized-file', conflict: options.writeConflicts });
    else if (record.installedSha256 !== digest(content)) actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'template-update' });
  }
  return { actions, records };
}
export function mcpPlan(target: string, options: Options, current: InstallState | null, uninstall = false): Action | null {
  const managed = current && current.managedConfiguration && current.managedConfiguration.mcp;
  if (uninstall && !managed) return null;
  if (!uninstall && (options.profile === 'minimal' || options.mcp === false)) return null;
  const relative = '.mcp.json'; const file = within(target, relative); const name = options.serverName;
  if (uninstall) {
    if (!managed) return null; // unreachable (guarded above); narrows the type
    if (!present(file)) return { op: 'skip-config', relative, reason: 'mcp-file-missing' };
    const parsed = json(file); const found = parsed.mcpServers && parsed.mcpServers[name];
    return parsed.__error ? { op: 'preserve-config', relative, reason: 'invalid-mcp-json' } : digest(stable(found)) === managed.expectedValueSha256 ? { op: 'remove-mcp', relative, name, reason: 'owned-mcp-entry' } : { op: 'preserve-config', relative, reason: 'customized-mcp-entry' };
  }
  const value = graphServer(options); const expectedHash = digest(stable(value));
  if (!present(file)) return { op: 'merge-mcp', relative, name, value, expectedHash, reason: 'new-mcp-file' };
  const parsed = json(file); if (parsed.__error) return { op: 'preserve-config', relative, reason: 'invalid-mcp-json' };
  const found = parsed.mcpServers && parsed.mcpServers[name]; const foundHash = digest(stable(found));
  if (found === undefined || (managed && foundHash === managed.expectedValueSha256 && foundHash !== expectedHash)) return { op: 'merge-mcp', relative, name, value, expectedHash, reason: found === undefined ? 'missing-mcp-entry' : 'owned-mcp-update' };
  return managed && foundHash === managed.expectedValueSha256 ? { op: 'skip-config', relative, reason: 'mcp-current' } : { op: 'preserve-config', relative, reason: 'existing-mcp-entry-not-owned' };
}
/** Root-anchored, forward-slash .gitignore line for one installed file. */
export function ignoreLineFor(relative: string): string {
  return '/' + relative.replace(/\\/g, '/').replace(/[\\*?[\]]/g, '\\$&').replace(/ $/, '\\ ');
}
/**
 * Ignore actions. `owned` lists installer-owned files whose lines should be present (empty when
 * the per-file option is off, which retires any previously managed per-file lines and comment).
 */
export function ignorePlan(target: string, current: InstallState | null, uninstall = false, owned: string[] = []): Action[] {
  const relative = '.gitignore'; const file = within(target, relative); const lines = present(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const tracked = current && current.managedConfiguration && current.managedConfiguration.gitignore ? current.managedConfiguration.gitignore.lines : [];
  const add = (line: string): Action => ({ op: 'add-ignore', relative, line, reason: 'missing-ignore-line' });
  const remove = (line: string, reason: string): Action => ({ op: 'remove-ignore', relative, line, reason });
  if (uninstall) return tracked.map((line) => remove(line, 'owned-ignore-line'));
  const actions: Action[] = IGNORE.filter((line) => !lines.includes(line)).map(add);
  const wanted = [...new Set(owned.map(ignoreLineFor))].sort();
  const managedFileLines = tracked.filter((line) => !IGNORE.includes(line) && line !== IGNORE_COMMENT);
  for (const line of managedFileLines) if (!wanted.includes(line)) actions.push(remove(line, 'no-longer-owned-file'));
  if (!wanted.length) { if (tracked.includes(IGNORE_COMMENT)) actions.push(remove(IGNORE_COMMENT, 'gitignore-option-off')); return actions; }
  if (!lines.includes(IGNORE_COMMENT)) actions.push({ op: 'add-ignore', relative, line: IGNORE_COMMENT, reason: 'managed-comment' });
  for (const line of wanted) if (!lines.includes(line)) actions.push({ op: 'add-ignore', relative, line, reason: 'installed-file' });
  return actions;
}

/** Owned files already tracked by git, or [] when git is missing or target is not in a work tree. */
export function trackedOwned(target: string, owned: string[]): string[] {
  const git = (args: string[]) => spawnSync('git', ['--literal-pathspecs', '-C', target, ...args], { encoding: 'utf8' });
  const inside = git(['rev-parse', '--is-inside-work-tree']);
  if (inside.error || inside.status !== 0 || inside.stdout.trim() !== 'true') return [];
  const found: string[] = [];
  for (let i = 0; i < owned.length; i += 200) {
    const r = git(['ls-files', '-z', '--', ...owned.slice(i, i + 200)]);
    if (!r.error && r.status === 0) found.push(...r.stdout.split('\0').filter(Boolean));
  }
  return [...new Set(found)].sort();
}
