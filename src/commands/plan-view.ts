import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { die, present, write } from '../fs-safe';
import type { Options } from '../types';

function ticketFile(target: string, id: string | null): string {
  if (!id) die('plan-view requires --ticket <ticket-id>');
  const directory = path.join(target, 'ai-workspace', 'tickets');
  if (!present(directory)) die('ticket directory is missing');
  const name = fs.readdirSync(directory).find((entry) => entry.startsWith(id) && entry.endsWith('.md'));
  if (!name) die(`ticket not found: ${id}`);
  return path.join(directory, name);
}
function html(value: string): string { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

export function planView(target: string, options: Options): void {
  const file = ticketFile(target, options.ticket);
  const render = (notice = ''): string => {
    const ticket = fs.readFileSync(file, 'utf8');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Plan review</title><style>body{font:16px system-ui;margin:2rem;max-width:960px;background:#111;color:#eee}pre{white-space:pre-wrap;background:#1b1b1b;padding:1rem;border-radius:.5rem}button{padding:.55rem .8rem;margin-right:.5rem}.ok{color:#9f9}</style></head><body><h1>Plan review: ${html(options.ticket as string)}</h1>${notice ? `<p class="ok">${html(notice)}</p>` : ''}<form method="post" action="/decision"><button name="decision" value="APPROVED">Approve plan</button><button name="decision" value="CHANGES REQUESTED">Request changes</button></form><p>This loopback-only viewer updates the ticket's <code>Plan approval</code> field. The Markdown ticket remains canonical.</p><pre>${html(ticket)}</pre></body></html>`;
  };
  const server = http.createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return response.end(render()); }
    if (request.method === 'POST' && request.url === '/decision') {
      let body = ''; request.on('data', (chunk) => { body += chunk; }); request.on('end', () => {
        const decision = new URLSearchParams(body).get('decision');
        if (decision === null || !['APPROVED', 'CHANGES REQUESTED'].includes(decision)) { response.writeHead(400); return response.end('invalid decision'); }
        const text = fs.readFileSync(file, 'utf8');
        const line = `**Plan approval:** ${decision}`;
        const next = /^\*\*Plan approval:\*\*.*$/m.test(text) ? text.replace(/^\*\*Plan approval:\*\*.*$/m, line) : text.replace(/^(\*\*Status:\*\*.*)$/m, `$1\n${line}`);
        write(file, next); response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); response.end(render(`Plan marked ${decision}.`));
      }); return;
    }
    response.writeHead(404); response.end('not found');
  });
  server.listen(options.port, '127.0.0.1', () => {
    const address = server.address() as AddressInfo; console.log(`Plan viewer: http://127.0.0.1:${address.port}/`); console.log('Loopback-only. Press Ctrl+C to stop.');
  });
}
