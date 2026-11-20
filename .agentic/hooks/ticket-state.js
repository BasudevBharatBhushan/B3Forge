// GENERATED from src/hooks/ticket-state.ts — do not edit
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
exports.run = run;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function run(target) {
    const registry = path.join(target, 'ai-workspace', 'active-tickets');
    if (!fs.existsSync(registry))
        return { level: 'info', message: 'No active ticket registry.' };
    const content = fs.readFileSync(registry, 'utf8');
    if (/\|\s*T-\d+.*\[~\]|dispatched.*unverified/i.test(content)) {
        return { level: 'warn', message: 'An active ticket may have an unverified dispatched subtask; reconcile ticket and git state.' };
    }
    return { level: 'info', message: 'No stale dispatched ticket state detected.' };
}
if (require.main === module)
    process.stdout.write(JSON.stringify(run(process.cwd())) + '\n');
