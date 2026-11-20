import * as path from 'node:path';

// Compiled modules live in dist/ (one level below the repo root), so the template root is
// the parent of this file's directory.
export const ROOT = path.resolve(__dirname, '..');
export const STATE = '.agentic/install-state.json';
export const COMMANDS = new Set(['install', 'status', 'doctor', 'update', 'repair', 'uninstall', 'adopt', 'scan', 'handoff', 'plan-view']);
export const PROFILES = new Set(['minimal', 'core', 'strict']);
export const HARNESSES = new Set(['claude', 'codex', 'cursor', 'copilot']);
export const BASE = ['.agents', '.agentic', 'ai-workspace', 'LESSONS.md', 'SETUP.md', 'AGENTS.md'];
export const IGNORE = ['graphify-out/', 'temp/', 'tmp/', '.agentic/install-state.json', '.agentic/memory/', '.agentic/config.json'];

export interface PackageJson { name: string; version: string }
export function packageJson(): PackageJson {
  return require(path.join(ROOT, 'package.json')) as PackageJson;
}
