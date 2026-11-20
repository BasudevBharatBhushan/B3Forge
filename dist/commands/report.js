"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.report = report;
const fs_safe_1 = require("../fs-safe");
const plan_1 = require("../plan");
const state_1 = require("../state");
function report(target, options, doctor = false) {
    const current = (0, state_1.loadState)(target);
    const result = { version: current.template.version, profile: current.profile, unchanged: [], modified: [], missing: [], warnings: [] };
    for (const [relative, record] of Object.entries(current.files))
        result[(0, state_1.statusOf)(target, relative, record)].push(relative);
    const managedMcp = current.managedConfiguration && current.managedConfiguration.mcp;
    if (managedMcp) {
        const value = (0, fs_safe_1.json)((0, fs_safe_1.within)(target, managedMcp.path));
        if (value.__error)
            result.warnings.push('.mcp.json is invalid JSON');
    }
    if (current.components && current.components.graphifyMcp && !(0, plan_1.commandExists)('graphify') && !(0, plan_1.commandExists)('uv'))
        result.warnings.push('graphify or uv is not on PATH');
    if (options.json)
        console.log(JSON.stringify(result, null, 2));
    else {
        console.log(`Installed version: ${result.version}\nProfile: ${result.profile}\nOwned files — unchanged: ${result.unchanged.length}, modified: ${result.modified.length}, missing: ${result.missing.length}`);
        for (const name of result.modified)
            console.log(`WARN  customized file preserved: ${name}`);
        for (const name of result.missing)
            console.log(`FAIL  missing owned file: ${name}`);
        for (const warning of result.warnings)
            console.log(`WARN  ${warning}`);
    }
    if (doctor && (result.modified.length || result.missing.length || result.warnings.length))
        process.exitCode = 2;
}
