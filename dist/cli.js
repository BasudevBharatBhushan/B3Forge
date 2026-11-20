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
// Local-first lifecycle manager. It tracks only files it actually writes and never treats a
// familiar filename as proof of ownership.
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const args_1 = require("./args");
const constants_1 = require("./constants");
const fs_safe_1 = require("./fs-safe");
const adopt_1 = require("./commands/adopt");
const handoff_1 = require("./commands/handoff");
const install_1 = require("./commands/install");
const plan_view_1 = require("./commands/plan-view");
const report_1 = require("./commands/report");
const repair_1 = require("./commands/repair");
const scan_1 = require("./commands/scan");
const uninstall_1 = require("./commands/uninstall");
function main() {
    const options = (0, args_1.parseArgs)(process.argv.slice(2));
    if (options.help)
        return (0, args_1.help)();
    if (options.version)
        return console.log((0, constants_1.packageJson)().version);
    const target = path.resolve(options.target || process.cwd());
    if (!(0, fs_safe_1.present)(target) || !fs.statSync(target).isDirectory())
        (0, fs_safe_1.die)(`target directory does not exist: ${target}`);
    if (target === path.resolve(constants_1.ROOT) && options.command !== 'scan')
        (0, fs_safe_1.die)('refusing to scaffold the template into itself');
    switch (options.command) {
        case 'install': return (0, install_1.install)(target, options);
        case 'update': return (0, install_1.install)(target, options, true);
        case 'status': return (0, report_1.report)(target, options);
        case 'doctor': return (0, report_1.report)(target, options, true);
        case 'repair': return (0, repair_1.repair)(target, options);
        case 'uninstall': return (0, uninstall_1.uninstall)(target, options);
        case 'adopt': return (0, adopt_1.adopt)(target, options);
        case 'scan': return (0, scan_1.scan)(target, options);
        case 'plan-view': return (0, plan_view_1.planView)(target, options);
        default: return (0, handoff_1.handoff)(target, options);
    }
}
try {
    main();
}
catch (error) {
    const e = error;
    console.error(`error: ${e.message}`);
    // Non-CLI errors (e.g. fs errors) carry a string code; assigned as before to keep behavior identical.
    process.exitCode = e.code || 1;
}
