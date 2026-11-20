"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.install = install;
const constants_1 = require("../constants");
const actions_1 = require("../actions");
const fs_safe_1 = require("../fs-safe");
const plan_1 = require("../plan");
const state_1 = require("../state");
function install(target, options, update = false) {
    if (options.profile === 'strict' && !options.enableHooks)
        (0, fs_safe_1.die)('strict profile requires --enable-hooks; hooks are optional and require explicit consent');
    const existing = (0, state_1.loadState)(target, true);
    if (update && !existing)
        (0, fs_safe_1.die)(`no install state at ${constants_1.STATE}; use adopt or install`, 3);
    const effective = update && existing ? {
        ...options,
        profile: existing.profile,
        harnesses: new Set(existing.harnesses || ['claude']),
        // An update must preserve installation choices. In particular, a project that selected
        // --no-mcp must not gain an MCP entry simply because the new CLI defaults to core.
        mcp: existing.components && existing.components.graphifyMcp ? options.mcp : false,
    } : options;
    const plan = (0, plan_1.plannedFiles)(target, effective, existing);
    const current = existing || (0, state_1.createState)(effective, plan.records);
    const actions = [...plan.actions, ...[(0, plan_1.mcpPlan)(target, effective, current), ...(0, plan_1.ignorePlan)(target, current)].flatMap((a) => a ? [a] : [])];
    (0, actions_1.show)(actions, options);
    (0, actions_1.apply)(target, actions, options, current, plan.records);
    if (!options.dryRun) {
        current.template.version = (0, constants_1.packageJson)().version;
        current.template.installedAt = new Date().toISOString();
        (0, state_1.save)(target, current, options);
    }
    console.log(options.dryRun ? '\nDry run — no files changed.' : '\nCompleted safely. Run `agentic-init doctor .` for diagnostics.');
}
