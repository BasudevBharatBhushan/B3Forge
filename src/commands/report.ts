import { json, within } from '../fs-safe';
import { commandExists } from '../plan';
import { loadState, statusOf } from '../state';
import type { Options } from '../types';

interface Report {
  version: string;
  profile: string;
  unchanged: string[];
  modified: string[];
  missing: string[];
  warnings: string[];
  gitignoreInstalledFiles: boolean;
}

export function report(target: string, options: Options, doctor = false): void {
  const current = loadState(target); const result: Report = { version: current.template.version, profile: current.profile, unchanged: [], modified: [], missing: [], warnings: [], gitignoreInstalledFiles: !!(current.components && current.components.gitignoreInstalledFiles) };
  for (const [relative, record] of Object.entries(current.files)) result[statusOf(target, relative, record)].push(relative);
  const managedMcp = current.managedConfiguration && current.managedConfiguration.mcp;
  if (managedMcp) { const value = json(within(target, managedMcp.path)); if (value.__error) result.warnings.push('.mcp.json is invalid JSON'); }
  if (current.components && current.components.graphifyMcp && !commandExists('graphify') && !commandExists('uv')) result.warnings.push('graphify or uv is not on PATH');
  if (options.json) console.log(JSON.stringify(result, null, 2)); else {
    console.log(`Installed version: ${result.version}\nProfile: ${result.profile}\nGitignore installed files: ${result.gitignoreInstalledFiles ? 'on' : 'off'}\nOwned files — unchanged: ${result.unchanged.length}, modified: ${result.modified.length}, missing: ${result.missing.length}`);
    for (const name of result.modified) console.log(`WARN  customized file preserved: ${name}`); for (const name of result.missing) console.log(`FAIL  missing owned file: ${name}`); for (const warning of result.warnings) console.log(`WARN  ${warning}`);
  }
  if (doctor && (result.modified.length || result.missing.length || result.warnings.length)) process.exitCode = 2;
}
