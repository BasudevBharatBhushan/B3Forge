// GENERATED from src/hooks/ticket-state.ts — do not edit
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
exports.run = run;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const ID = /^T-\d+(?:\.\d+)?/;
const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim().replace(/`/g, ''));
const status = (text) => (text.match(/^\*\*Status:\*\*\s*([A-Z_]+)/m) || [])[1] || '';
function run(target) {
    const registry = path.join(target, 'ai-workspace', 'active-tickets');
    if (!fs.existsSync(registry))
        return { level: 'info', message: 'No active ticket registry.' };
    const problems = [];
    const text = fs.readFileSync(registry, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
    for (const line of text.split(/\r?\n/)) {
        if (!/^\s*\|/.test(line))
            continue;
        const c = cells(line);
        const id = (c[0] || '').match(ID);
        if (!id)
            continue; // header, separator, "no tickets in flight"
        const file = path.join(target, c[1] || '');
        if (!c[1] || !fs.existsSync(file)) {
            problems.push(`${id[0]}: registry points to a missing ticket file`);
            continue;
        }
        const body = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        const actual = status(body);
        if (actual !== (c[2] || '').split(/\s/)[0])
            problems.push(`${id[0]}: registry says ${c[2]}, ticket says ${actual || 'no Status'}`);
        if (actual === 'COMPLETED')
            problems.push(`${id[0]}: COMPLETED ticket is still in active-tickets`);
        if (/^\*\*Current subtask:\*\*.*dispatched.*unverified/im.test(body) || /^\|[^|]*\|.*\|\s*\[~\]\s*\|\s*$/m.test(body))
            problems.push(`${id[0]}: dispatched subtask is unverified; reconcile ticket and git state`);
    }
    const dir = path.join(target, 'ai-workspace', 'tickets');
    if (fs.existsSync(dir))
        for (const name of fs.readdirSync(dir).filter((f) => /^T-\d.*\.md$/.test(f))) {
            const body = fs.readFileSync(path.join(dir, name), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
            if (status(body) === 'COMPLETED' && /^\|[^|]*\|.*\|\s*\[[ ~]\]\s*\|\s*$/m.test(body))
                problems.push(`${name}: COMPLETED ticket has unfinished subtasks`);
        }
    return problems.length
        ? { level: 'warn', message: `Ticket state needs attention: ${problems.join('; ')}. Run validate for details.` }
        : { level: 'info', message: 'Ticket state is consistent.' };
}
if (require.main === module)
    process.stdout.write(JSON.stringify(run(process.cwd())) + '\n');
