import * as fs from 'node:fs';
import { apply, show } from '../actions';
import { die } from '../fs-safe';
import { ignorePlan, mcpPlan } from '../plan';
import { loadState, save, statePath, statusOf } from '../state';
import type { Action, Options } from '../types';

export function uninstall(target: string, options: Options): void {
  const current = loadState(target); const actions: Action[] = [];
  for (const [relative, record] of Object.entries(current.files)) { const found = statusOf(target, relative, record); if (found === 'unchanged') actions.push({ op: 'remove-file', relative, reason: 'pristine-owned-file' }); else if (found === 'modified') actions.push({ op: 'preserve', relative, reason: 'customized-file' }); }
  const effective: Options = { ...options, profile: current.profile, harnesses: new Set(current.harnesses || []) };
  for (const a of [mcpPlan(target, effective, current, true), ...ignorePlan(target, current, true)]) if (a) actions.push(a);
  show(actions, options);
  if (!options.dryRun && !options.yes) die('uninstall requires --yes; use --dry-run to preview');
  apply(target, actions, options, current, current.files);
  if (!options.dryRun) { if (Object.keys(current.files).length) save(target, current, options); else fs.unlinkSync(statePath(target)); }
  console.log(options.dryRun ? '\nDry run — no files changed.' : '\nUninstall completed; customized files were preserved.');
}
