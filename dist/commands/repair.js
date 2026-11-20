"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.repair = repair;
const constants_1 = require("../constants");
const actions_1 = require("../actions");
const fs_safe_1 = require("../fs-safe");
const plan_1 = require("../plan");
const state_1 = require("../state");
function repair(target, options) {
    const current = (0, state_1.loadState)(target);
    const actions = [];
    for (const [relative, record] of Object.entries(current.files))
        if ((0, state_1.statusOf)(target, relative, record) === 'missing' && (0, fs_safe_1.present)((0, fs_safe_1.within)(constants_1.ROOT, record.source)))
            actions.push({ op: 'write', relative, content: (0, plan_1.source)(record.source), reason: 'restore-missing-owned-file' });
    (0, actions_1.show)(actions, options);
    (0, actions_1.apply)(target, actions, options, current, current.files);
    (0, state_1.save)(target, current, options);
    console.log(options.dryRun ? '\nDry run — no files changed.' : '\nRepair completed; customized files were preserved.');
}
