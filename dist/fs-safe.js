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
exports.die = die;
exports.present = present;
exports.digest = digest;
exports.fileHash = fileHash;
exports.safeRelative = safeRelative;
exports.within = within;
exports.write = write;
exports.json = json;
exports.stable = stable;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function die(message, code = 1) {
    const error = new Error(message);
    error.code = code;
    throw error;
}
function present(file) { try {
    fs.lstatSync(file);
    return true;
}
catch {
    return false;
} }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fileHash(file) { return digest(fs.readFileSync(file)); }
function safeRelative(value) {
    const clean = String(value).replace(/\\/g, '/').replace(/^\.\//, '');
    if (!clean || path.isAbsolute(clean) || clean.includes('\0') || clean.split('/').includes('..'))
        die(`unsafe path: ${value}`, 2);
    return clean;
}
function within(target, relative) {
    const out = path.resolve(target, safeRelative(relative));
    const root = path.resolve(target);
    if (out !== root && !out.startsWith(root + path.sep))
        die(`path escapes target: ${relative}`, 2);
    // A managed path must not pass through a symlink. Otherwise a benign-looking relative state
    // record could write or delete outside the selected project.
    let cursor = root;
    for (const segment of safeRelative(relative).split('/')) {
        if (present(cursor) && fs.lstatSync(cursor).isSymbolicLink())
            die(`managed path uses a symlink: ${relative}`, 2);
        cursor = path.join(cursor, segment);
    }
    if (present(cursor) && fs.lstatSync(cursor).isSymbolicLink())
        die(`managed path is a symlink: ${relative}`, 2);
    return out;
}
function write(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.agentic-tmp-${process.pid}`;
    fs.writeFileSync(temp, value, 'utf8');
    fs.renameSync(temp, file);
}
function json(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch (e) {
        return { __error: e.message };
    }
}
function stable(value) { return value === undefined ? '__undefined__' : JSON.stringify(value, null, 2); }
