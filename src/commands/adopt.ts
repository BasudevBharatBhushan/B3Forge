import { show } from '../actions';
import { die, digest, fileHash, present, within } from '../fs-safe';
import { desired, source } from '../plan';
import { createState, loadState, save } from '../state';
import type { Action, FileRecord, Options } from '../types';

export function adopt(target: string, options: Options): void {
  if (loadState(target, true)) die('install state already exists'); const files: Record<string, FileRecord> = {};
  for (const relative of desired(options)) { const file = within(target, relative); if (present(file) && fileHash(file) === digest(source(relative))) files[relative] = { kind: 'file', source: relative, installedSha256: fileHash(file) }; }
  const actions: Action[] = Object.keys(files).map((relative) => ({ op: 'skip', relative, reason: 'exact-match-adopted' })); show(actions, options); save(target, createState(options, files), options); console.log(options.dryRun ? '\nDry run — no state written.' : `\nAdopted ${actions.length} exact template file(s); all others remain project-owned.`);
}
