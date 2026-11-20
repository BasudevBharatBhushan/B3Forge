"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.planView = planView;
const fs = __importStar(require("node:fs"));
const http = __importStar(require("node:http"));
const path = __importStar(require("node:path"));
const fs_safe_1 = require("../fs-safe");
const parse_1 = require("../ticket/parse");
function ticketFile(target, id) {
    if (!id)
        (0, fs_safe_1.die)('plan-view requires --ticket <ticket-id>');
    const directory = path.join(target, 'ai-workspace', 'tickets');
    if (!(0, fs_safe_1.present)(directory))
        (0, fs_safe_1.die)('ticket directory is missing');
    const name = (0, parse_1.findTicketFile)(directory, id);
    if (!name)
        (0, fs_safe_1.die)(`ticket not found: ${id}`);
    return path.join(directory, name);
}
function html(value) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function planView(target, options) {
    const file = ticketFile(target, options.ticket);
    const render = (notice = '') => {
        const ticket = fs.readFileSync(file, 'utf8');
        return `<!doctype html><html><head><meta charset="utf-8"><title>Plan review</title><style>body{font:16px system-ui;margin:2rem;max-width:960px;background:#111;color:#eee}pre{white-space:pre-wrap;background:#1b1b1b;padding:1rem;border-radius:.5rem}button{padding:.55rem .8rem;margin-right:.5rem}.ok{color:#9f9}</style></head><body><h1>Plan review: ${html(options.ticket)}</h1>${notice ? `<p class="ok">${html(notice)}</p>` : ''}<form method="post" action="/decision"><button name="decision" value="APPROVED">Approve plan</button><button name="decision" value="CHANGES REQUESTED">Request changes</button></form><p>This loopback-only viewer updates the ticket's <code>Plan approval</code> field. The Markdown ticket remains canonical.</p><pre>${html(ticket)}</pre></body></html>`;
    };
    const server = http.createServer((request, response) => {
        if (request.method === 'GET' && request.url === '/') {
            response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            return response.end(render());
        }
        if (request.method === 'POST' && request.url === '/decision') {
            let body = '';
            request.on('data', (chunk) => { body += chunk; });
            request.on('end', () => {
                const decision = new URLSearchParams(body).get('decision');
                if (decision === null || !['APPROVED', 'CHANGES REQUESTED'].includes(decision)) {
                    response.writeHead(400);
                    return response.end('invalid decision');
                }
                const text = fs.readFileSync(file, 'utf8');
                const line = `**Plan approval:** ${decision}`;
                const next = /^\*\*Plan approval:\*\*.*$/m.test(text) ? text.replace(/^\*\*Plan approval:\*\*.*$/m, line) : text.replace(/^(\*\*Status:\*\*.*)$/m, `$1\n${line}`);
                (0, fs_safe_1.write)(file, next);
                response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
                response.end(render(`Plan marked ${decision}.`));
            });
            return;
        }
        response.writeHead(404);
        response.end('not found');
    });
    server.listen(options.port, '127.0.0.1', () => {
        const address = server.address();
        console.log(`Plan viewer: http://127.0.0.1:${address.port}/`);
        console.log('Loopback-only. Press Ctrl+C to stop.');
    });
}
