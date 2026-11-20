import { COMMANDS, HARNESSES, PROFILES } from './constants';
import { die } from './fs-safe';
import type { Options } from './types';

export function parseArgs(argv: string[]): Options {
  const result: Options = { command: 'install', target: null, profile: 'core', harnesses: new Set(['claude']), dryRun: false, json: false, yes: false, writeConflicts: false, enableHooks: false, strict: false, mcp: undefined, graphPath: 'graphify-out/graph.json', serverName: 'graphify', format: 'text', ticket: null, closing: false, port: 0, handoffAction: null, help: false, version: false };
  const positional: string[] = [];
  // `validate` reports bad usage as exit 2 (documented); other commands keep exit 1.
  const usageCode = argv.find((x) => !x.startsWith('-')) === 'validate' ? 2 : 1;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]; const take = (): string => { const v = argv[++i]; if (!v || v.startsWith('-')) die(`${arg} requires a value`, usageCode); return v; };
    if (arg === '-h' || arg === '--help') result.help = true;
    else if (arg === '-v' || arg === '--version') result.version = true;
    else if (arg === '-n' || arg === '--dry-run') result.dryRun = true;
    else if (arg === '--json') result.json = true;
    else if (arg === '--closing') result.closing = true;
    else if (arg === '--yes') result.yes = true;
    else if (arg === '--write-conflicts') result.writeConflicts = true;
    else if (arg === '--enable-hooks') result.enableHooks = true;
    else if (arg === '--strict') result.strict = true;
    else if (arg === '--no-mcp') result.mcp = false;
    else if (arg === '--no-skill') { /* compatibility flag: no global skills are installed */ }
    else if (arg === '--profile') result.profile = take();
    else if (arg === '--harness') result.harnesses = new Set(take().split(',').filter(Boolean));
    else if (arg === '--all-harnesses') result.harnesses = new Set(HARNESSES);
    else if (arg === '--graph-path') result.graphPath = take();
    else if (arg === '--server-name') result.serverName = take();
    else if (arg === '--format') result.format = take();
    else if (arg === '--ticket') result.ticket = take();
    else if (arg === '--port') result.port = Number(take());
    else if (arg.startsWith('-')) die(`unknown flag: ${arg}`, usageCode);
    else positional.push(arg);
  }
  if (COMMANDS.has(positional[0])) result.command = positional.shift() as string;
  if (result.command === 'handoff' && ['create', 'list', 'show'].includes(positional[0])) result.handoffAction = positional.shift() as string;
  if (positional.length) result.target = positional.shift() as string;
  if (positional.length) die(`unexpected argument: ${positional[0]}`, result.command === 'validate' ? 2 : 1);
  if (!PROFILES.has(result.profile)) die(`unknown profile: ${result.profile}`);
  if (!['text', 'json'].includes(result.format)) die(`unknown format: ${result.format}`);
  if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535) die('--port must be an integer from 0 to 65535');
  for (const harness of result.harnesses) if (!HARNESSES.has(harness)) die(`unknown harness: ${harness}`);
  return result;
}

export function help(): void {
  console.log(`agentic-init — safe project-local template lifecycle

Usage: agentic-init [install] [target] [options]
       agentic-init <status|doctor|update|repair|uninstall|adopt|scan> [target]
       agentic-init handoff <create|list|show> [target] --ticket <id>
       agentic-init plan-view [target] --ticket <id> [--port <port>]
       agentic-init validate [target] [--ticket <id> [--closing]]

Commands: install, status, doctor, update, repair, uninstall, adopt, scan, handoff, plan-view, validate
Options: --dry-run --profile minimal|core|strict --harness claude,codex,cursor,copilot
         --all-harnesses --enable-hooks --strict --no-mcp --write-conflicts --yes --json --port

Use update --dry-run before update. Modified and unknown files are always preserved.`);
}
