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
exports.scan = scan;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const fs_safe_1 = require("../fs-safe");
function scan(target, options) {
    const findings = [];
    const rules = [['AGT001', /(?:bypass|disable|ignore)\s+(?:all\s+)?(?:safety|approval|guard)/i, 'high', 'Instruction may bypass safeguards.'], ['AGT002', /(?:curl|wget|irm)\b[^\n]*\|\s*(?:sh|bash|powershell|pwsh)/i, 'high', 'Piped remote shell command.'], ['AGT003', /\b(?:rm\s+-rf|Remove-Item\s+.*-Recurse.*-Force)\b/i, 'high', 'Broad destructive command.'], ['AGT004', /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{16,}/i, 'critical', 'Possible literal secret.'], ['AGT005', /uses:\s+[^\s@]+@(?![a-f0-9]{40}\b)/i, 'medium', 'Unpinned GitHub Action.']];
    const files = [];
    const visit = (file) => { if (!(0, fs_safe_1.present)(file))
        return; if (fs.statSync(file).isFile())
        files.push(file);
    else
        for (const entry of fs.readdirSync(file, { withFileTypes: true }))
            if (!['memory', 'node_modules', '.git'].includes(entry.name))
                visit(path.join(file, entry.name)); };
    for (const name of ['AGENTS.md', 'CLAUDE.md', '.agentic', '.claude', '.codex', '.cursor', '.github', '.mcp.json'])
        visit((0, fs_safe_1.within)(target, name));
    for (const file of files) {
        let lines;
        try {
            lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        }
        catch {
            continue;
        }
        lines.forEach((line, index) => rules.forEach(([id, pattern, severity, message]) => {
            // Policy files often prohibit a dangerous command. A deterministic scanner must not
            // flag an explicit prohibition as though it were an instruction to execute it.
            const context = `${lines[index - 1] || ''} ${line} ${lines[index + 1] || ''}`;
            const prohibited = id === 'AGT003' && /(?:\b(?:no|never|avoid|don't|do not)\b.{0,180}|\bapproval\b.{0,180})(?:rm\s+-rf|Remove-Item)/i.test(context);
            if (pattern.test(line) && !prohibited)
                findings.push({ id, severity, file: path.relative(target, file).replace(/\\/g, '/'), line: index + 1, message });
        }));
    }
    if (options.json || options.format === 'json')
        console.log(JSON.stringify({ findings }, null, 2));
    else if (!findings.length)
        console.log('PASS  no deterministic agent-configuration findings');
    else
        findings.forEach((f) => console.log(`${f.severity.toUpperCase().padEnd(8)} ${f.id} ${f.file}:${f.line} — ${f.message}`));
    if (findings.some((f) => f.severity === 'critical' || (options.strict && f.severity === 'high')))
        process.exitCode = 2;
}
