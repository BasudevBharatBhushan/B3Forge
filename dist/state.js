"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statePath = statePath;
exports.loadState = loadState;
exports.createState = createState;
exports.statusOf = statusOf;
exports.save = save;
const constants_1 = require("./constants");
const fs_safe_1 = require("./fs-safe");
function statePath(target) { return (0, fs_safe_1.within)(target, constants_1.STATE); }
function loadState(target, optional = false) {
    const file = statePath(target);
    if (!(0, fs_safe_1.present)(file)) {
        if (optional)
            return null;
        (0, fs_safe_1.die)(`no install state at ${constants_1.STATE}; use install or adopt first`, 3);
    }
    const value = (0, fs_safe_1.json)(file);
    if (value.__error || value.schemaVersion !== 1 || !value.files || typeof value.files !== 'object')
        (0, fs_safe_1.die)('invalid or unsupported install state', 2);
    for (const [name, record] of Object.entries(value.files)) {
        (0, fs_safe_1.safeRelative)(name);
        (0, fs_safe_1.within)(target, name);
        if (!record || !/^[a-f0-9]{64}$/.test(record.installedSha256 || ''))
            (0, fs_safe_1.die)(`invalid state fingerprint: ${name}`, 2);
    }
    return value;
}
function createState(options, files = {}) {
    const pkg = (0, constants_1.packageJson)();
    return { schemaVersion: 1, template: { package: pkg.name, version: pkg.version, installedAt: new Date().toISOString() }, target: { path: '.', platform: process.platform }, profile: options.profile, harnesses: [...options.harnesses].sort(), components: { baseWorkflow: true, graphifyMcp: options.profile !== 'minimal' && options.mcp !== false, hooks: options.profile === 'strict', review: options.profile === 'strict', securityScan: options.profile === 'strict', memory: options.profile !== 'minimal' }, files, managedConfiguration: { gitignore: { path: '.gitignore', lines: [] } } };
}
function statusOf(target, relative, record) {
    const file = (0, fs_safe_1.within)(target, relative);
    return !(0, fs_safe_1.present)(file) ? 'missing' : (0, fs_safe_1.fileHash)(file) === record.installedSha256 ? 'unchanged' : 'modified';
}
function save(target, value, options) {
    if (!options.dryRun)
        (0, fs_safe_1.write)(statePath(target), JSON.stringify(value, null, 2) + '\n');
}
