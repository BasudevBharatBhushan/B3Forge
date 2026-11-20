// Local-first lifecycle manager. It tracks only files it actually writes and never treats a
// familiar filename as proof of ownership.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { help, parseArgs } from './args';
import { ROOT, packageJson } from './constants';
import { die, present } from './fs-safe';
import { adopt } from './commands/adopt';
import { handoff } from './commands/handoff';
import { install } from './commands/install';
import { planView } from './commands/plan-view';
import { report } from './commands/report';
import { repair } from './commands/repair';
import { scan } from './commands/scan';
import { uninstall } from './commands/uninstall';
import type { ExitError } from './types';

function main(): void {
  const options = parseArgs(process.argv.slice(2)); if (options.help) return help(); if (options.version) return console.log(packageJson().version);
  const target = path.resolve(options.target || process.cwd()); if (!present(target) || !fs.statSync(target).isDirectory()) die(`target directory does not exist: ${target}`);
  if (target === path.resolve(ROOT) && options.command !== 'scan') die('refusing to scaffold the template into itself');
  switch (options.command) {
    case 'install': return install(target, options);
    case 'update': return install(target, options, true);
    case 'status': return report(target, options);
    case 'doctor': return report(target, options, true);
    case 'repair': return repair(target, options);
    case 'uninstall': return uninstall(target, options);
    case 'adopt': return adopt(target, options);
    case 'scan': return scan(target, options);
    case 'plan-view': return planView(target, options);
    default: return handoff(target, options);
  }
}
try { main(); } catch (error) {
  const e = error as ExitError;
  console.error(`error: ${e.message}`);
  // Non-CLI errors (e.g. fs errors) carry a string code; assigned as before to keep behavior identical.
  process.exitCode = e.code || 1;
}
