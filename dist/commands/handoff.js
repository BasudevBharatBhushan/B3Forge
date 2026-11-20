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
exports.handoff = handoff;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const fs_safe_1 = require("../fs-safe");
function handoff(target, options) {
    const action = options.handoffAction || 'list';
    const directory = (0, fs_safe_1.within)(target, '.agentic/memory');
    if (action === 'list') {
        if (!(0, fs_safe_1.present)(directory))
            return console.log('No handoffs.');
        return fs.readdirSync(directory).filter((x) => x.endsWith('.md')).forEach((x) => console.log(x));
    }
    if (action === 'show') {
        const name = options.ticket || (0, fs_safe_1.die)('handoff show requires --ticket <file>');
        const file = (0, fs_safe_1.within)(target, `.agentic/memory/${name.endsWith('.md') ? name : `${name}.md`}`);
        if (!(0, fs_safe_1.present)(file))
            (0, fs_safe_1.die)(`handoff not found: ${name}`);
        process.stdout.write(fs.readFileSync(file, 'utf8'));
        return;
    }
    if (action !== 'create')
        (0, fs_safe_1.die)(`unknown handoff action: ${action}`);
    const id = options.ticket || (0, fs_safe_1.die)('handoff create requires --ticket <ticket-id>');
    const tickets = path.join(target, 'ai-workspace', 'tickets');
    const match = (0, fs_safe_1.present)(tickets) && fs.readdirSync(tickets).find((x) => x.startsWith(id) && x.endsWith('.md'));
    if (!match)
        (0, fs_safe_1.die)(`ticket not found: ${id}`);
    const header = fs.readFileSync(path.join(tickets, match), 'utf8').split(/^---\s*$/m)[0].trim();
    const name = `${id}-${new Date().toISOString().slice(0, 10)}.md`;
    const content = `---\nformat: agentic-memory-v1\nstatus: proposed\nscope: ticket\ncreated: ${new Date().toISOString()}\nsourceTicket: ${id}\ntags: [handoff]\ntrust: unreviewed\n---\n\n# Handoff: ${id}\n\n## Evidence\n\n${header}\n\n## Reuse guidance\n\nReview the source ticket and current git state before continuing.\n\n## Verification needed\n\nConfirm ticket status, claimed files, and actual working-tree state.\n`;
    if (options.dryRun)
        console.log(`CREATE    .agentic/memory/${name} — proposed handoff`);
    else {
        (0, fs_safe_1.write)((0, fs_safe_1.within)(target, `.agentic/memory/${name}`), content);
        console.log(`Created .agentic/memory/${name}`);
    }
}
