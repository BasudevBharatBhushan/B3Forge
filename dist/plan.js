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
exports.isLocalOnly = isLocalOnly;
exports.desired = desired;
exports.source = source;
exports.commandExists = commandExists;
exports.plannedFiles = plannedFiles;
exports.mcpPlan = mcpPlan;
exports.ignoreLineFor = ignoreLineFor;
exports.ignorePlan = ignorePlan;
exports.trackedOwned = trackedOwned;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const constants_1 = require("./constants");
const fs_safe_1 = require("./fs-safe");
const state_1 = require("./state");
/** Local, untracked content a dev checkout may contain under .claude/; never installed. */
function isLocalOnly(relative) {
    const clean = relative.replace(/\\/g, '/').replace(/^\.\//, '');
    return clean === '.claude/worktrees' || clean.startsWith('.claude/worktrees/') || clean === '.claude/settings.local.json';
}
function sourceFiles(relative, output = []) {
    if (isLocalOnly(relative))
        return output;
    const src = path.join(constants_1.ROOT, relative);
    if (!(0, fs_safe_1.present)(src))
        return output;
    if (fs.statSync(src).isFile()) {
        const clean = (0, fs_safe_1.safeRelative)(relative);
        if (clean !== constants_1.STATE)
            output.push(clean);
        return output;
    }
    for (const name of fs.readdirSync(src))
        sourceFiles(path.join(relative, name), output);
    return output;
}
function desired(options) {
    const roots = [...constants_1.BASE];
    if (options.harnesses.has('claude'))
        roots.push('.claude', 'CLAUDE.md');
    if (options.harnesses.has('codex'))
        roots.push('.codex');
    if (options.harnesses.has('cursor'))
        roots.push('.cursor');
    if (options.harnesses.has('copilot'))
        roots.push('.github');
    const files = new Set();
    for (const root of roots)
        for (const file of sourceFiles(root))
            files.add(file);
    if (options.profile !== 'strict')
        for (const file of [...files])
            if (file.startsWith('.agentic/hooks/'))
                files.delete(file);
    for (const file of [...files])
        if (file.startsWith('.github/workflows/'))
            files.delete(file);
    return [...files].sort();
}
function source(relative) { return fs.readFileSync((0, fs_safe_1.within)(constants_1.ROOT, relative)); }
function commandExists(command) { return (0, node_child_process_1.spawnSync)(process.platform === 'win32' ? 'where.exe' : 'which', [command]).status === 0; }
function graphServer(options) {
    return commandExists('uv')
        ? { command: 'uv', args: ['run', '--with', 'graphifyy', '--with', 'mcp', '-m', 'graphify.serve', options.graphPath] }
        : { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-m', 'graphify.serve', options.graphPath] };
}
function plannedFiles(target, options, existing) {
    const actions = [];
    const records = existing ? { ...existing.files } : {};
    for (const relative of desired(options)) {
        const destination = (0, fs_safe_1.within)(target, relative);
        const content = source(relative);
        const incoming = (0, fs_safe_1.digest)(content);
        const owned = records[relative];
        if (!owned && relative === 'CLAUDE.md' && (0, fs_safe_1.present)(destination) && !(0, fs_safe_1.present)((0, fs_safe_1.within)(target, 'CLAUDE.agentic.md'))) {
            actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: relative, content, reason: 'existing-project-claude-md' });
        }
        else if (!owned)
            actions.push(!(0, fs_safe_1.present)(destination) ? { op: 'write', relative, source: relative, content, reason: 'new-template-file' } : { op: 'preserve', relative, reason: 'existing-file-not-owned' });
        else if ((0, state_1.statusOf)(target, relative, owned) === 'missing')
            actions.push({ op: 'write', relative, source: owned.source, content, reason: 'missing-owned-file' });
        else if ((0, state_1.statusOf)(target, relative, owned) === 'modified')
            actions.push({ op: 'preserve', relative, content, reason: 'customized-file', conflict: options.writeConflicts });
        else if (owned.installedSha256 !== incoming)
            actions.push({ op: 'write', relative, source: owned.source, content, reason: 'template-update' });
        else
            actions.push({ op: 'skip', relative, reason: 'already-current' });
    }
    // An existing project CLAUDE.md is never managed. Its generated companion is, so include it
    // in future updates even though it is not a normal source-path destination.
    if (records['CLAUDE.agentic.md']) {
        const record = records['CLAUDE.agentic.md'];
        const content = source(record.source);
        const found = (0, state_1.statusOf)(target, 'CLAUDE.agentic.md', record);
        if (found === 'missing')
            actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'missing-owned-file' });
        else if (found === 'modified')
            actions.push({ op: 'preserve', relative: 'CLAUDE.agentic.md', content, reason: 'customized-file', conflict: options.writeConflicts });
        else if (record.installedSha256 !== (0, fs_safe_1.digest)(content))
            actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'template-update' });
    }
    return { actions, records };
}
function mcpPlan(target, options, current, uninstall = false) {
    const managed = current && current.managedConfiguration && current.managedConfiguration.mcp;
    if (uninstall && !managed)
        return null;
    if (!uninstall && (options.profile === 'minimal' || options.mcp === false))
        return null;
    const relative = '.mcp.json';
    const file = (0, fs_safe_1.within)(target, relative);
    const name = options.serverName;
    if (uninstall) {
        if (!managed)
            return null; // unreachable (guarded above); narrows the type
        if (!(0, fs_safe_1.present)(file))
            return { op: 'skip-config', relative, reason: 'mcp-file-missing' };
        const parsed = (0, fs_safe_1.json)(file);
        const found = parsed.mcpServers && parsed.mcpServers[name];
        return parsed.__error ? { op: 'preserve-config', relative, reason: 'invalid-mcp-json' } : (0, fs_safe_1.digest)((0, fs_safe_1.stable)(found)) === managed.expectedValueSha256 ? { op: 'remove-mcp', relative, name, reason: 'owned-mcp-entry' } : { op: 'preserve-config', relative, reason: 'customized-mcp-entry' };
    }
    const value = graphServer(options);
    const expectedHash = (0, fs_safe_1.digest)((0, fs_safe_1.stable)(value));
    if (!(0, fs_safe_1.present)(file))
        return { op: 'merge-mcp', relative, name, value, expectedHash, reason: 'new-mcp-file' };
    const parsed = (0, fs_safe_1.json)(file);
    if (parsed.__error)
        return { op: 'preserve-config', relative, reason: 'invalid-mcp-json' };
    const found = parsed.mcpServers && parsed.mcpServers[name];
    const foundHash = (0, fs_safe_1.digest)((0, fs_safe_1.stable)(found));
    if (found === undefined || (managed && foundHash === managed.expectedValueSha256 && foundHash !== expectedHash))
        return { op: 'merge-mcp', relative, name, value, expectedHash, reason: found === undefined ? 'missing-mcp-entry' : 'owned-mcp-update' };
    return managed && foundHash === managed.expectedValueSha256 ? { op: 'skip-config', relative, reason: 'mcp-current' } : { op: 'preserve-config', relative, reason: 'existing-mcp-entry-not-owned' };
}
/** Root-anchored, forward-slash .gitignore line for one installed file. */
function ignoreLineFor(relative) {
    return '/' + relative.replace(/\\/g, '/').replace(/[\\*?[\]]/g, '\\$&').replace(/ $/, '\\ ');
}
/**
 * Ignore actions. `owned` lists installer-owned files whose lines should be present (empty when
 * the per-file option is off, which retires any previously managed per-file lines and comment).
 */
function ignorePlan(target, current, uninstall = false, owned = []) {
    const relative = '.gitignore';
    const file = (0, fs_safe_1.within)(target, relative);
    const lines = (0, fs_safe_1.present)(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
    const tracked = current && current.managedConfiguration && current.managedConfiguration.gitignore ? current.managedConfiguration.gitignore.lines : [];
    const add = (line) => ({ op: 'add-ignore', relative, line, reason: 'missing-ignore-line' });
    const remove = (line, reason) => ({ op: 'remove-ignore', relative, line, reason });
    if (uninstall)
        return tracked.map((line) => remove(line, 'owned-ignore-line'));
    const actions = constants_1.IGNORE.filter((line) => !lines.includes(line)).map(add);
    const wanted = [...new Set(owned.map(ignoreLineFor))].sort();
    const managedFileLines = tracked.filter((line) => !constants_1.IGNORE.includes(line) && line !== constants_1.IGNORE_COMMENT);
    for (const line of managedFileLines)
        if (!wanted.includes(line))
            actions.push(remove(line, 'no-longer-owned-file'));
    if (!wanted.length) {
        if (tracked.includes(constants_1.IGNORE_COMMENT))
            actions.push(remove(constants_1.IGNORE_COMMENT, 'gitignore-option-off'));
        return actions;
    }
    if (!lines.includes(constants_1.IGNORE_COMMENT))
        actions.push({ op: 'add-ignore', relative, line: constants_1.IGNORE_COMMENT, reason: 'managed-comment' });
    for (const line of wanted)
        if (!lines.includes(line))
            actions.push({ op: 'add-ignore', relative, line, reason: 'installed-file' });
    return actions;
}
/** Owned files already tracked by git, or [] when git is missing or target is not in a work tree. */
function trackedOwned(target, owned) {
    const git = (args) => (0, node_child_process_1.spawnSync)('git', ['--literal-pathspecs', '-C', target, ...args], { encoding: 'utf8' });
    const inside = git(['rev-parse', '--is-inside-work-tree']);
    if (inside.error || inside.status !== 0 || inside.stdout.trim() !== 'true')
        return [];
    const found = [];
    for (let i = 0; i < owned.length; i += 200) {
        const r = git(['ls-files', '-z', '--', ...owned.slice(i, i + 200)]);
        if (!r.error && r.status === 0)
            found.push(...r.stdout.split('\0').filter(Boolean));
    }
    return [...new Set(found)].sort();
}
