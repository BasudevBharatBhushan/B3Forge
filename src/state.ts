import { STATE, packageJson } from './constants';
import { die, digest, fileHash, json, present, safeRelative, within, write } from './fs-safe';
import type { FileRecord, FileStatus, InstallState, Options } from './types';

export function statePath(target: string): string { return within(target, STATE); }

/** Returns the validated install state, or null when absent and `optional` is set. */
export function loadState(target: string, optional: true): InstallState | null;
export function loadState(target: string, optional?: false): InstallState;
export function loadState(target: string, optional = false): InstallState | null {
  const file = statePath(target);
  if (!present(file)) { if (optional) return null; die(`no install state at ${STATE}; use install or adopt first`, 3); }
  const value = json(file) as unknown as InstallState & { __error?: string };
  if (value.__error || value.schemaVersion !== 1 || !value.files || typeof value.files !== 'object') die('invalid or unsupported install state', 2);
  for (const [name, record] of Object.entries(value.files)) {
    safeRelative(name); within(target, name);
    if (!record || !/^[a-f0-9]{64}$/.test(record.installedSha256 || '')) die(`invalid state fingerprint: ${name}`, 2);
  }
  return value;
}

export function createState(options: Options, files: Record<string, FileRecord> = {}): InstallState {
  const pkg = packageJson();
  return { schemaVersion: 1, template: { package: pkg.name, version: pkg.version, installedAt: new Date().toISOString() }, target: { path: '.', platform: process.platform }, profile: options.profile, harnesses: [...options.harnesses].sort(), components: { baseWorkflow: true, graphifyMcp: options.profile !== 'minimal' && options.mcp !== false, hooks: options.profile === 'strict', review: options.profile === 'strict', securityScan: options.profile === 'strict', memory: options.profile !== 'minimal', gitignoreInstalledFiles: options.gitignore === true }, files, managedConfiguration: { gitignore: { path: '.gitignore', lines: [] } } };
}

export function statusOf(target: string, relative: string, record: FileRecord): FileStatus {
  const file = within(target, relative);
  return !present(file) ? 'missing' : fileHash(file) === record.installedSha256 ? 'unchanged' : 'modified';
}

export function save(target: string, value: InstallState, options: Options): void {
  if (!options.dryRun) write(statePath(target), JSON.stringify(value, null, 2) + '\n');
}
