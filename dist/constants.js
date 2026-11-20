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
exports.IGNORE = exports.BASE = exports.HARNESSES = exports.PROFILES = exports.COMMANDS = exports.STATE = exports.ROOT = void 0;
exports.packageJson = packageJson;
const path = __importStar(require("node:path"));
// Compiled modules live in dist/ (one level below the repo root), so the template root is
// the parent of this file's directory.
exports.ROOT = path.resolve(__dirname, '..');
exports.STATE = '.agentic/install-state.json';
exports.COMMANDS = new Set(['install', 'status', 'doctor', 'update', 'repair', 'uninstall', 'adopt', 'scan', 'handoff', 'plan-view', 'validate']);
exports.PROFILES = new Set(['minimal', 'core', 'strict']);
exports.HARNESSES = new Set(['claude', 'codex', 'cursor', 'copilot']);
exports.BASE = ['.agents', '.agentic', 'ai-workspace', 'LESSONS.md', 'SETUP.md', 'AGENTS.md'];
exports.IGNORE = ['graphify-out/', 'temp/', 'tmp/', '.agentic/install-state.json', '.agentic/memory/', '.agentic/config.json'];
function packageJson() {
    return require(path.join(exports.ROOT, 'package.json'));
}
