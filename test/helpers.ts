import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

// Works from both test/ (source) and .test-dist/ (compiled): the repo root is one level up.
export const root = path.resolve(__dirname, '..');
export const cli = path.join(root, 'bin', 'cli.js');
export const STATE = path.join('.agentic', 'install-state.json');

export interface Result { status: number | null; stdout: string; stderr: string }

export function run(args: string[]): Result {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

const made: string[] = [];
export function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'b3forge-test-'));
  made.push(dir);
  return dir;
}
export function cleanup(): void {
  for (const dir of made.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

export const exists = (dir: string, rel: string): boolean => fs.existsSync(path.join(dir, rel));
export const read = (dir: string, rel: string): string => fs.readFileSync(path.join(dir, rel), 'utf8');
export const writeFile = (dir: string, rel: string, text: string): void => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
};
export const sha = (text: string | Buffer): string => crypto.createHash('sha256').update(text).digest('hex');

export interface InstallState {
  schemaVersion: number;
  profile: string;
  harnesses: string[];
  components: Record<string, boolean>;
  files: Record<string, { kind: string; source: string; installedSha256: string }>;
  managedConfiguration: Record<string, unknown>;
}
export const readState = (dir: string): InstallState => JSON.parse(read(dir, STATE)) as InstallState;
export const writeState = (dir: string, s: InstallState): void => writeFile(dir, STATE, JSON.stringify(s, null, 2));

/** Recursively list files under dir (relative, forward-slash). */
export function listFiles(dir: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, r)); else out.push(r);
  }
  return out.sort();
}

/** Install with --no-mcp (avoids dependence on uv/python) and assert success. */
export function install(dir: string, extra: string[] = []): Result {
  return run([dir, '--no-mcp', ...extra]);
}
