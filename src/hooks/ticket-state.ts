import * as fs from 'fs';
import * as path from 'path';

// A validate-style check, inlined on purpose. Hooks run with plain node inside the user's project
// and cannot import dist/, and shelling out to `npx github:... validate` would need network and
// seconds of startup on every event. This covers only the registry/ticket-state subset of the
// `validate` command (src/commands/validate.ts is the source of truth for the full rules):
// every registry row points to a real ticket whose Status matches, no in-flight ticket has an
// unverified dispatched subtask, and no COMPLETED ticket has open subtasks or lingers in the registry.

interface Result { level: 'info' | 'warn'; message: string }

const ID = /^T-\d+(?:\.\d+)?/;
const cells = (row: string): string[] => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/`/g, ''));
const status = (text: string): string => (text.match(/^\*\*Status:\*\*\s*([A-Z_]+)/m) || [])[1] || '';

function run(target: string): Result {
  const registry = path.join(target, 'ai-workspace', 'active-tickets');
  if (!fs.existsSync(registry)) return { level: 'info', message: 'No active ticket registry.' };
  const problems: string[] = [];
  const text = fs.readFileSync(registry, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  for (const line of text.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) continue;
    const c = cells(line);
    const id = (c[0] || '').match(ID);
    if (!id) continue; // header, separator, "no tickets in flight"
    const file = path.join(target, c[1] || '');
    if (!c[1] || !fs.existsSync(file)) { problems.push(`${id[0]}: registry points to a missing ticket file`); continue; }
    const body = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    const actual = status(body);
    if (actual !== (c[2] || '').split(/\s/)[0]) problems.push(`${id[0]}: registry says ${c[2]}, ticket says ${actual || 'no Status'}`);
    if (actual === 'COMPLETED') problems.push(`${id[0]}: COMPLETED ticket is still in active-tickets`);
    if (/^\*\*Current subtask:\*\*.*dispatched.*unverified/im.test(body) || /^\|[^|]*\|.*\|\s*\[~\]\s*\|\s*$/m.test(body)) problems.push(`${id[0]}: dispatched subtask is unverified; reconcile ticket and git state`);
  }
  const dir = path.join(target, 'ai-workspace', 'tickets');
  if (fs.existsSync(dir)) for (const name of fs.readdirSync(dir).filter((f) => /^T-\d.*\.md$/.test(f))) {
    const body = fs.readFileSync(path.join(dir, name), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    if (status(body) === 'COMPLETED' && /^\|[^|]*\|.*\|\s*\[[ ~]\]\s*\|\s*$/m.test(body)) problems.push(`${name}: COMPLETED ticket has unfinished subtasks`);
  }
  return problems.length
    ? { level: 'warn', message: `Ticket state needs attention: ${problems.join('; ')}. Run validate for details.` }
    : { level: 'info', message: 'Ticket state is consistent.' };
}

if (require.main === module) process.stdout.write(JSON.stringify(run(process.cwd())) + '\n');
export { run };
