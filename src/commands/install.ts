import { STATE, packageJson } from '../constants';
import { apply, show } from '../actions';
import { die } from '../fs-safe';
import { ignorePlan, mcpPlan, plannedFiles } from '../plan';
import { createState, loadState, save } from '../state';
import type { Options } from '../types';

export function install(target: string, options: Options, update = false): void {
  if (options.profile === 'strict' && !options.enableHooks) die('strict profile requires --enable-hooks; hooks are optional and require explicit consent');
  const existing = loadState(target, true); if (update && !existing) die(`no install state at ${STATE}; use adopt or install`, 3);
  const effective: Options = update && existing ? {
    ...options,
    profile: existing.profile,
    harnesses: new Set(existing.harnesses || ['claude']),
    // An update must preserve installation choices. In particular, a project that selected
    // --no-mcp must not gain an MCP entry simply because the new CLI defaults to core.
    mcp: existing.components && existing.components.graphifyMcp ? options.mcp : false,
  } : options;
  const plan = plannedFiles(target, effective, existing); const current = existing || createState(effective, plan.records);
  const actions = [...plan.actions, ...[mcpPlan(target, effective, current), ...ignorePlan(target, current)].flatMap((a) => a ? [a] : [])];
  show(actions, options); apply(target, actions, options, current, plan.records);
  // plan.records is a shallow copy of existing.files; carry its refreshed fingerprints into the saved state.
  current.files = plan.records;
  if (!options.dryRun) { current.template.version = packageJson().version; current.template.installedAt = new Date().toISOString(); save(target, current, options); }
  console.log(options.dryRun ? '\nDry run — no files changed.' : '\nCompleted safely. Run `agentic-init doctor .` for diagnostics.');
}
