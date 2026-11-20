import * as fs from 'node:fs';
import * as path from 'node:path';
import { die, present, within, write } from '../fs-safe';
import type { Options } from '../types';

export function handoff(target: string, options: Options): void {
  const action = options.handoffAction || 'list'; const directory = within(target, '.agentic/memory');
  if (action === 'list') { if (!present(directory)) return console.log('No handoffs.'); return fs.readdirSync(directory).filter((x) => x.endsWith('.md')).forEach((x) => console.log(x)); }
  if (action === 'show') { const name = options.ticket || die('handoff show requires --ticket <file>'); const file = within(target, `.agentic/memory/${name.endsWith('.md') ? name : `${name}.md`}`); if (!present(file)) die(`handoff not found: ${name}`); process.stdout.write(fs.readFileSync(file, 'utf8')); return; }
  if (action !== 'create') die(`unknown handoff action: ${action}`);
  const id = options.ticket || die('handoff create requires --ticket <ticket-id>'); const tickets = path.join(target, 'ai-workspace', 'tickets'); const match = present(tickets) && fs.readdirSync(tickets).find((x) => x.startsWith(id) && x.endsWith('.md')); if (!match) die(`ticket not found: ${id}`);
  const header = fs.readFileSync(path.join(tickets, match), 'utf8').split(/^---\s*$/m)[0].trim(); const name = `${id}-${new Date().toISOString().slice(0, 10)}.md`; const content = `---\nformat: agentic-memory-v1\nstatus: proposed\nscope: ticket\ncreated: ${new Date().toISOString()}\nsourceTicket: ${id}\ntags: [handoff]\ntrust: unreviewed\n---\n\n# Handoff: ${id}\n\n## Evidence\n\n${header}\n\n## Reuse guidance\n\nReview the source ticket and current git state before continuing.\n\n## Verification needed\n\nConfirm ticket status, claimed files, and actual working-tree state.\n`;
  if (options.dryRun) console.log(`CREATE    .agentic/memory/${name} — proposed handoff`); else { write(within(target, `.agentic/memory/${name}`), content); console.log(`Created .agentic/memory/${name}`); }
}
