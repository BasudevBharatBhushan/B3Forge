"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adopt = adopt;
const actions_1 = require("../actions");
const fs_safe_1 = require("../fs-safe");
const plan_1 = require("../plan");
const state_1 = require("../state");
function adopt(target, options) {
    if ((0, state_1.loadState)(target, true))
        (0, fs_safe_1.die)('install state already exists');
    const files = {};
    for (const relative of (0, plan_1.desired)(options)) {
        const file = (0, fs_safe_1.within)(target, relative);
        if ((0, fs_safe_1.present)(file) && (0, fs_safe_1.fileHash)(file) === (0, fs_safe_1.digest)((0, plan_1.source)(relative)))
            files[relative] = { kind: 'file', source: relative, installedSha256: (0, fs_safe_1.fileHash)(file) };
    }
    const actions = Object.keys(files).map((relative) => ({ op: 'skip', relative, reason: 'exact-match-adopted' }));
    (0, actions_1.show)(actions, options);
    (0, state_1.save)(target, (0, state_1.createState)(options, files), options);
    console.log(options.dryRun ? '\nDry run — no state written.' : `\nAdopted ${actions.length} exact template file(s); all others remain project-owned.`);
}
