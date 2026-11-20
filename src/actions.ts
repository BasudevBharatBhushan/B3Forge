import * as fs from 'node:fs';
import { digest, json, present, within, write } from './fs-safe';
import type { Action, FileRecord, InstallState, Options } from './types';

export function label(action: Action): string {
  switch (action.op) {
    case 'write': return action.reason === 'template-update' ? 'UPDATE' : action.reason.includes('missing') ? 'RESTORE' : 'CREATE';
    case 'preserve': case 'preserve-config': return 'PRESERVE';
    case 'skip': case 'skip-config': return 'SKIP';
    case 'merge-mcp': return 'MERGE';
    case 'remove-mcp': case 'remove-ignore': case 'remove-file': return 'REMOVE';
    case 'add-ignore': return 'ADD';
  }
}

export function show(actions: Action[], options: Options): void {
  if (options.json) {
    console.log(JSON.stringify(actions.map((a) => { const rest: Record<string, unknown> = { ...a }; delete rest.content; return rest; }), null, 2));
    return;
  }
  for (const action of actions) {
    const line = 'line' in action ? action.line : undefined;
    console.log(`${label(action).padEnd(9)} ${action.relative || ''}${line ? ` — ${line}` : ''} — ${action.reason}`);
    if ('conflict' in action && action.conflict) console.log(`CONFLICT  ${action.relative}.agentic-new — proposed template version`);
  }
}

export function apply(target: string, actions: Action[], options: Options, current: InstallState, records: Record<string, FileRecord>): void {
  if (options.dryRun) return;
  for (const action of actions) {
    const file = within(target, action.relative);
    if (action.op === 'write') { write(file, action.content); records[action.relative] = { kind: 'file', source: action.source || action.relative, installedSha256: digest(action.content) }; }
    else if (action.op === 'preserve' && action.conflict && action.content) write(`${file}.agentic-new`, action.content);
    else if (action.op === 'merge-mcp') {
      const value = present(file) ? json(file) : {}; if (value.__error) continue;
      value.mcpServers = value.mcpServers && typeof value.mcpServers === 'object' ? value.mcpServers : {}; value.mcpServers[action.name] = action.value;
      write(file, JSON.stringify(value, null, 2) + '\n'); current.managedConfiguration.mcp = { path: action.relative, keys: [`mcpServers.${action.name}`], expectedValueSha256: action.expectedHash };
    } else if (action.op === 'add-ignore') {
      const text = present(file) ? fs.readFileSync(file, 'utf8') : ''; write(file, text + (text && !text.endsWith('\n') ? '\n' : '') + action.line + '\n');
      if (!current.managedConfiguration.gitignore.lines.includes(action.line)) current.managedConfiguration.gitignore.lines.push(action.line);
    } else if (action.op === 'remove-file') { if (present(file)) fs.unlinkSync(file); delete records[action.relative]; }
    else if (action.op === 'remove-mcp') {
      const value = json(file); if (value.__error || !value.mcpServers) continue; delete value.mcpServers[action.name]; if (!Object.keys(value.mcpServers).length) delete value.mcpServers; write(file, JSON.stringify(value, null, 2) + '\n'); delete current.managedConfiguration.mcp;
    } else if (action.op === 'remove-ignore' && present(file)) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); if (lines.filter((line) => line === action.line).length !== 1) continue;
      write(file, lines.filter((line) => line !== action.line).join('\n').replace(/\n*$/, '\n')); current.managedConfiguration.gitignore.lines = current.managedConfiguration.gitignore.lines.filter((line) => line !== action.line);
    }
  }
}
