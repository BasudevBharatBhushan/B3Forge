import { STATE, packageJson } from '../constants';
import { apply, show } from '../actions';
import { die } from '../fs-safe';
import { ignorePlan, mcpPlan, plannedFiles, trackedOwned } from '../plan';
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
  // The gitignore choice is persisted; a flag on update/install overrides it, otherwise it carries over.
  const gitignore = options.gitignore !== undefined ? options.gitignore : !!(existing && existing.components && existing.components.gitignoreInstalledFiles);
  effective.gitignore = gitignore;
  const plan = plannedFiles(target, effective, existing); const current = existing || createState(effective, plan.records);
  // Files owned after this run: existing records plus anything newly written (incl. the CLAUDE.agentic.md companion).
  const owned = [...new Set([...Object.keys(plan.records), ...plan.actions.flatMap((a) => a.op === 'write' ? [a.relative] : [])])].sort();
  const actions = [...plan.actions, ...[mcpPlan(target, effective, current), ...ignorePlan(target, current, false, gitignore ? owned : [])].flatMap((a) => a ? [a] : [])];
  current.components.gitignoreInstalledFiles = gitignore;
  show(actions, options); apply(target, actions, options, current, plan.records);
  // plan.records is a shallow copy of existing.files; carry its refreshed fingerprints into the saved state.
  current.files = plan.records;
  if (!options.dryRun) { current.template.version = packageJson().version; current.template.installedAt = new Date().toISOString(); save(target, current, options); }
  if (gitignore && !options.json) {
    const tracked = trackedOwned(target, owned);
    if (tracked.length) {
      const quote = (p: string): string => /^[\w@%+=:,./-]+$/.test(p) ? p : `'${p.replace(/'/g, `'\\''`)}'`;
      console.log(`\nNOTE: .gitignore does not untrack files already in git. ${tracked.length} installed file(s) are already tracked.\nTo stop tracking them (keeps the files on disk), run this yourself from ${target}:\n  git rm --cached -- ${tracked.map(quote).join(' ')}`);
    }
  }
  console.log(options.dryRun ? '\nDry run — no files changed.' : '\nCompleted safely. Run `agentic-init doctor .` for diagnostics.');
}
