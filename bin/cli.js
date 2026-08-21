#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const PKG_ROOT = path.join(__dirname, '..');

// Copied verbatim into the target. CLAUDE.md is handled separately — it is merged, never
// overwritten, because a project's own CLAUDE.md carries context this template does not know.
const PAYLOAD = ['.agents', '.claude', 'ai-workspace', 'LESSONS.md', 'SETUP.md'];

// Appended to an existing .gitignore rather than replacing it. Shipping a .gitignore in an
// npm tarball does not work anyway — npm renames it to .npmignore on pack.
const IGNORE_BLOCK = [
  '# --- agentic-development-template ---',
  'graphify-out/',
  'temp/',
  'tmp/',
];

const COLOR = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (code) => (s) => (COLOR ? '[' + code + 'm' + s + '[0m' : String(s));

const c = {
  dim: wrap(2),
  bold: wrap(1),
  green: wrap(32),
  yellow: wrap(33),
  red: wrap(31),
  cyan: wrap(36),
};

const created = [];
const skipped = [];
const notes = [];

function parseArgs(argv) {
  const opts = {
    target: null,
    force: false,
    dryRun: false,
    mcp: true,
    skill: true,
    graphPath: 'graphify-out/graph.json',
    serverName: 'graphify',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') opts.help = true;
    else if (a === '--version' || a === '-v') opts.version = true;
    else if (a === '--force' || a === '-f') opts.force = true;
    else if (a === '--dry-run' || a === '-n') opts.dryRun = true;
    else if (a === '--no-mcp') opts.mcp = false;
    else if (a === '--no-skill') opts.skill = false;
    else if (a === '--graph-path') opts.graphPath = argv[++i];
    else if (a === '--server-name') opts.serverName = argv[++i];
    else if (a.startsWith('-')) fail('unknown flag: ' + a);
    else if (opts.target === null) opts.target = a;
    else fail('unexpected argument: ' + a);
  }
  return opts;
}

function fail(msg) {
  console.error(c.red('error') + ' ' + msg);
  console.error('Run ' + c.cyan('agentic-init --help') + ' for usage.');
  process.exit(1);
}

function usage() {
  console.log([
    '',
    c.bold('agentic-init') + ' — scaffold the agentic development workflow into a project',
    '',
    c.bold('Usage'),
    '  npx agentic-development-template [target] [options]',
    '',
    c.bold('What it writes'),
    '  CLAUDE.md             the operating manual (merged, never overwritten)',
    '  .agents/              rule and workflow reference docs, ticket templates',
    '  .claude/skills/       /testing, /refactor, /ui-responsiveness',
    '  ai-workspace/         tickets, sql, docs, the active-ticket pointer',
    '  .mcp.json             the graphify MCP server, merged into any existing config',
    '  .gitignore            appends graphify-out/, temp/, tmp/ if absent',
    '',
    c.bold('Options'),
    '  -f, --force           overwrite files that already exist',
    '  -n, --dry-run         report what would happen, write nothing',
    '      --no-mcp          skip the .mcp.json graphify server entry',
    '      --no-skill        skip installing the graphify /graphify skill',
    '      --graph-path <p>  graph.json location (default graphify-out/graph.json)',
    '      --server-name <n> MCP server key to write (default graphify)',
    '  -h, --help            this',
    '  -v, --version         print version',
    '',
    c.bold('Notes'),
    '  Existing files are never clobbered without --force. An existing CLAUDE.md is left',
    '  alone and the template lands beside it as CLAUDE.agentic.md for you to merge.',
    '',
  ].join('\n'));
}

function copyTree(src, dest, opts, label) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!opts.dryRun) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyTree(path.join(src, entry), path.join(dest, entry), opts, label + '/' + entry);
    }
    return;
  }
  if (fs.existsSync(dest) && !opts.force) {
    skipped.push(label);
    return;
  }
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  created.push(label);
}

function writeManual(target, opts) {
  const src = path.join(PKG_ROOT, 'CLAUDE.md');
  const dest = path.join(target, 'CLAUDE.md');
  if (!fs.existsSync(dest) || opts.force) {
    if (!opts.dryRun) fs.copyFileSync(src, dest);
    created.push('CLAUDE.md');
    return;
  }
  // Already scaffolded and unedited — nothing to merge, so say nothing.
  if (fs.readFileSync(src, 'utf8') === fs.readFileSync(dest, 'utf8')) {
    skipped.push('CLAUDE.md');
    return;
  }
  const beside = path.join(target, 'CLAUDE.agentic.md');
  if (!opts.dryRun) fs.copyFileSync(src, beside);
  created.push('CLAUDE.agentic.md');
  notes.push(
    'You already have a CLAUDE.md. The template was written to CLAUDE.agentic.md instead —\n' +
    '  merge its sections 0–12 into yours, keep your project-specific context, then delete it.'
  );
}

function updateGitignore(target, opts) {
  const dest = path.join(target, '.gitignore');
  const existing = fs.existsSync(dest) ? fs.readFileSync(dest, 'utf8') : '';
  const lines = existing.split(/\r?\n/).map((l) => l.trim());
  const missing = IGNORE_BLOCK.filter((line) => !line.startsWith('#') && !lines.includes(line));
  if (missing.length === 0) {
    skipped.push('.gitignore (already covered)');
    return;
  }
  const sep = existing ? (existing.endsWith('\n') ? '\n' : '\n\n') : '';
  const block = sep + IGNORE_BLOCK[0] + '\n' + missing.join('\n') + '\n';
  if (!opts.dryRun) fs.writeFileSync(dest, existing + block, 'utf8');
  created.push(existing ? '.gitignore (appended)' : '.gitignore');
}

function which(cmd) {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  const r = spawnSync(probe, [cmd], { encoding: 'utf8' });
  const out = (r.stdout || '').trim();
  return r.status === 0 && out ? out.split(/\r?\n/)[0] : null;
}

function graphifyServer(graphPath) {
  // Preferred: uv runs the server in an isolated env, so the project needs no python setup.
  if (which('uv')) {
    return {
      command: 'uv',
      args: ['run', '--with', 'graphifyy', '--with', 'mcp', '-m', 'graphify.serve', graphPath],
    };
  }
  // Fallback: whatever python is on PATH, which must already have graphifyy installed.
  const py = which('python3') ? 'python3' : 'python';
  notes.push(
    'uv was not found, so .mcp.json points at ' + py + '. That interpreter must have\n' +
    '  graphifyy installed (pip install graphifyy). Installing uv and re-running with --force\n' +
    '  gives a self-contained server instead.'
  );
  return { command: py, args: ['-m', 'graphify.serve', graphPath] };
}

function writeMcp(target, opts) {
  const dest = path.join(target, '.mcp.json');
  const existed = fs.existsSync(dest);
  let config = { mcpServers: {} };
  if (existed) {
    try {
      config = JSON.parse(fs.readFileSync(dest, 'utf8'));
    } catch (e) {
      notes.push('.mcp.json exists but is not valid JSON (' + e.message + ') — left untouched.');
      skipped.push('.mcp.json (unparseable)');
      return;
    }
    if (!config.mcpServers) config.mcpServers = {};
  }
  if (config.mcpServers[opts.serverName] && !opts.force) {
    skipped.push('.mcp.json (' + opts.serverName + ' already configured)');
    return;
  }
  config.mcpServers[opts.serverName] = graphifyServer(opts.graphPath);
  if (!opts.dryRun) fs.writeFileSync(dest, JSON.stringify(config, null, 2) + '\n', 'utf8');
  created.push(existed ? '.mcp.json (' + opts.serverName + ' added)' : '.mcp.json');
}

function installGraphifySkill(opts) {
  if (!which('graphify')) {
    notes.push(
      'graphify is not on PATH. Discovery is graph-first, so install it before the first\n' +
      '  ticket:  ' + c.cyan('uv tool install graphifyy') + '  (or ' + c.cyan('pip install graphifyy') + ')'
    );
    return;
  }
  const installed = path.join(os.homedir(), '.claude', 'skills', 'graphify', 'SKILL.md');
  if (fs.existsSync(installed)) {
    skipped.push('graphify skill (already installed)');
    return;
  }
  if (opts.dryRun) {
    created.push('graphify skill (would run: graphify install --platform claude)');
    return;
  }
  const r = spawnSync('graphify', ['install', '--platform', 'claude'], { encoding: 'utf8', shell: true });
  if (r.status === 0) created.push('graphify skill (~/.claude/skills/graphify)');
  else notes.push('graphify install --platform claude failed — run it by hand.');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) return usage();
  if (opts.version) return console.log(require(path.join(PKG_ROOT, 'package.json')).version);

  const target = path.resolve(opts.target || process.cwd());
  if (path.resolve(PKG_ROOT) === target) {
    fail('refusing to scaffold the template into itself — run this from your project directory.');
  }
  if (!fs.existsSync(target)) fail('target does not exist: ' + target);

  console.log('\n' + c.bold('agentic-development-template') + ' -> ' + target);
  if (opts.dryRun) console.log(c.yellow('dry run — nothing will be written'));
  console.log('');

  for (const entry of PAYLOAD) {
    const src = path.join(PKG_ROOT, entry);
    if (!fs.existsSync(src)) continue;
    copyTree(src, path.join(target, entry), opts, entry);
  }
  writeManual(target, opts);
  updateGitignore(target, opts);
  if (opts.mcp) writeMcp(target, opts);
  if (opts.skill) installGraphifySkill(opts);

  if (created.length === 0) console.log('  ' + c.dim('nothing to write — already scaffolded'));
  const shown = created.slice(0, 12);
  for (const f of shown) console.log('  ' + c.green('+') + ' ' + f);
  if (created.length > shown.length) {
    console.log('  ' + c.green('+') + ' ' + c.dim('… ' + (created.length - shown.length) + ' more'));
  }
  if (skipped.length) {
    console.log('');
    for (const f of skipped.slice(0, 6)) console.log('  ' + c.dim('· ' + f + ' — exists, left alone'));
    if (skipped.length > 6) {
      console.log('  ' + c.dim('· … ' + (skipped.length - 6) + ' more (use --force to overwrite)'));
    }
  }
  if (notes.length) {
    console.log('');
    for (const n of notes) console.log('  ' + c.yellow('!') + ' ' + n);
  }

  console.log([
    '',
    c.bold('Next'),
    '  1. Fill in the ' + c.bold('section 0 Project Configuration') + ' table in CLAUDE.md — typecheck, lint,',
    '     and test commands, repo topology, packages. ' + c.dim('Run each one before recording it;'),
    '     ' + c.dim('a `test` script often runs something that is not a test suite.'),
    '  2. Build the knowledge graph: invoke ' + c.cyan('/graphify') + ' on the repo.',
    '  3. Restart Claude Code so it picks up ' + c.bold('.mcp.json') + ', and approve the graphify server.',
    '  4. Full checklist in ' + c.bold('SETUP.md') + '.',
    '',
  ].join('\n'));
}

main();
