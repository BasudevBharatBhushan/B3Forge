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
exports.uninstall = uninstall;
const fs = __importStar(require("node:fs"));
const actions_1 = require("../actions");
const fs_safe_1 = require("../fs-safe");
const plan_1 = require("../plan");
const state_1 = require("../state");
function uninstall(target, options) {
    const current = (0, state_1.loadState)(target);
    const actions = [];
    for (const [relative, record] of Object.entries(current.files)) {
        const found = (0, state_1.statusOf)(target, relative, record);
        if (found === 'unchanged')
            actions.push({ op: 'remove-file', relative, reason: 'pristine-owned-file' });
        else if (found === 'modified')
            actions.push({ op: 'preserve', relative, reason: 'customized-file' });
    }
    const effective = { ...options, profile: current.profile, harnesses: new Set(current.harnesses || []) };
    for (const a of [(0, plan_1.mcpPlan)(target, effective, current, true), ...(0, plan_1.ignorePlan)(target, current, true)])
        if (a)
            actions.push(a);
    (0, actions_1.show)(actions, options);
    if (!options.dryRun && !options.yes)
        (0, fs_safe_1.die)('uninstall requires --yes; use --dry-run to preview');
    (0, actions_1.apply)(target, actions, options, current, current.files);
    if (!options.dryRun) {
        if (Object.keys(current.files).length)
            (0, state_1.save)(target, current, options);
        else
            fs.unlinkSync((0, state_1.statePath)(target));
    }
    console.log(options.dryRun ? '\nDry run — no files changed.' : '\nUninstall completed; customized files were preserved.');
}
