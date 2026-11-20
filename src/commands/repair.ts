import { ROOT } from '../constants';
import { apply, show } from '../actions';
import { present, within } from '../fs-safe';
import { source } from '../plan';
import { loadState, save, statusOf } from '../state';
import type { Action, Options } from '../types';

export function repair(target: string, options: Options): void {
  const current = loadState(target); const actions: Action[] = [];
  for (const [relative, record] of Object.entries(current.files)) if (statusOf(target, relative, record) === 'missing' && present(within(ROOT, record.source))) actions.push({ op: 'write', relative, content: source(record.source), reason: 'restore-missing-owned-file' });
  show(actions, options); apply(target, actions, options, current, current.files); save(target, current, options); console.log(options.dryRun ? '\nDry run — no files changed.' : '\nRepair completed; customized files were preserved.');
}
