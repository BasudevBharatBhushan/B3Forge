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
exports.label = label;
exports.show = show;
exports.apply = apply;
const fs = __importStar(require("node:fs"));
const fs_safe_1 = require("./fs-safe");
function label(action) {
    switch (action.op) {
        case 'write': return action.reason === 'template-update' ? 'UPDATE' : action.reason.includes('missing') ? 'RESTORE' : 'CREATE';
        case 'preserve':
        case 'preserve-config': return 'PRESERVE';
        case 'skip':
        case 'skip-config': return 'SKIP';
        case 'merge-mcp': return 'MERGE';
        case 'remove-mcp':
        case 'remove-ignore':
        case 'remove-file': return 'REMOVE';
        case 'add-ignore': return 'ADD';
    }
}
function show(actions, options) {
    if (options.json) {
        console.log(JSON.stringify(actions.map((a) => { const rest = { ...a }; delete rest.content; return rest; }), null, 2));
        return;
    }
    for (const action of actions) {
        const line = 'line' in action ? action.line : undefined;
        console.log(`${label(action).padEnd(9)} ${action.relative || ''}${line ? ` — ${line}` : ''} — ${action.reason}`);
        if ('conflict' in action && action.conflict)
            console.log(`CONFLICT  ${action.relative}.agentic-new — proposed template version`);
    }
}
function apply(target, actions, options, current, records) {
    if (options.dryRun)
        return;
    for (const action of actions) {
        const file = (0, fs_safe_1.within)(target, action.relative);
        if (action.op === 'write') {
            (0, fs_safe_1.write)(file, action.content);
            records[action.relative] = { kind: 'file', source: action.source || action.relative, installedSha256: (0, fs_safe_1.digest)(action.content) };
        }
        else if (action.op === 'preserve' && action.conflict && action.content)
            (0, fs_safe_1.write)(`${file}.agentic-new`, action.content);
        else if (action.op === 'merge-mcp') {
            const value = (0, fs_safe_1.present)(file) ? (0, fs_safe_1.json)(file) : {};
            if (value.__error)
                continue;
            value.mcpServers = value.mcpServers && typeof value.mcpServers === 'object' ? value.mcpServers : {};
            value.mcpServers[action.name] = action.value;
            (0, fs_safe_1.write)(file, JSON.stringify(value, null, 2) + '\n');
            current.managedConfiguration.mcp = { path: action.relative, keys: [`mcpServers.${action.name}`], expectedValueSha256: action.expectedHash };
        }
        else if (action.op === 'add-ignore') {
            const text = (0, fs_safe_1.present)(file) ? fs.readFileSync(file, 'utf8') : '';
            (0, fs_safe_1.write)(file, text + (text && !text.endsWith('\n') ? '\n' : '') + action.line + '\n');
            if (!current.managedConfiguration.gitignore.lines.includes(action.line))
                current.managedConfiguration.gitignore.lines.push(action.line);
        }
        else if (action.op === 'remove-file') {
            if ((0, fs_safe_1.present)(file))
                fs.unlinkSync(file);
            delete records[action.relative];
        }
        else if (action.op === 'remove-mcp') {
            const value = (0, fs_safe_1.json)(file);
            if (value.__error || !value.mcpServers)
                continue;
            delete value.mcpServers[action.name];
            if (!Object.keys(value.mcpServers).length)
                delete value.mcpServers;
            (0, fs_safe_1.write)(file, JSON.stringify(value, null, 2) + '\n');
            delete current.managedConfiguration.mcp;
        }
        else if (action.op === 'remove-ignore' && (0, fs_safe_1.present)(file)) {
            const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
            if (lines.filter((line) => line === action.line).length !== 1)
                continue;
            (0, fs_safe_1.write)(file, lines.filter((line) => line !== action.line).join('\n').replace(/\n*$/, '\n'));
            current.managedConfiguration.gitignore.lines = current.managedConfiguration.gitignore.lines.filter((line) => line !== action.line);
        }
    }
}
