import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExitError, JsonFile } from './types';

export function die(message: string, code = 1): never {
  const error = new Error(message) as ExitError;
  error.code = code;
  throw error;
}
export function present(file: string): boolean { try { fs.lstatSync(file); return true; } catch { return false; } }
export function digest(value: string | Buffer): string { return crypto.createHash('sha256').update(value).digest('hex'); }
export function fileHash(file: string): string { return digest(fs.readFileSync(file)); }
export function safeRelative(value: string): string {
  const clean = String(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean || path.isAbsolute(clean) || clean.includes('\0') || clean.split('/').includes('..')) die(`unsafe path: ${value}`, 2);
  return clean;
}
export function within(target: string, relative: string): string {
  const out = path.resolve(target, safeRelative(relative)); const root = path.resolve(target);
  if (out !== root && !out.startsWith(root + path.sep)) die(`path escapes target: ${relative}`, 2);
  // A managed path must not pass through a symlink. Otherwise a benign-looking relative state
  // record could write or delete outside the selected project.
  let cursor = root;
  for (const segment of safeRelative(relative).split('/')) {
    if (present(cursor) && fs.lstatSync(cursor).isSymbolicLink()) die(`managed path uses a symlink: ${relative}`, 2);
    cursor = path.join(cursor, segment);
  }
  if (present(cursor) && fs.lstatSync(cursor).isSymbolicLink()) die(`managed path is a symlink: ${relative}`, 2);
  return out;
}
export function write(file: string, value: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.agentic-tmp-${process.pid}`;
  fs.writeFileSync(temp, value, 'utf8'); fs.renameSync(temp, file);
}
export function json(file: string): JsonFile {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonFile; } catch (e) { return { __error: (e as Error).message }; }
}
export function stable(value: unknown): string { return value === undefined ? '__undefined__' : JSON.stringify(value, null, 2); }
