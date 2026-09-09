#!/usr/bin/env node
'use strict';

// Local-first lifecycle manager. It tracks only files it actually writes and never treats a
// familiar filename as proof of ownership.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const STATE = '.agentic/install-state.json';
const COMMANDS = new Set(['install', 'status', 'doctor', 'update', 'repair', 'uninstall', 'adopt', 'scan', 'handoff']);
const PROFILES = new Set(['minimal', 'core', 'strict']);
const HARNESSES = new Set(['claude', 'codex', 'cursor', 'copilot']);
const BASE = ['.agents', '.agentic', 'ai-workspace', 'LESSONS.md', 'SETUP.md', 'AGENTS.md'];
const IGNORE = ['graphify-out/', 'temp/', 'tmp/', '.agentic/install-state.json', '.agentic/memory/', '.agentic/config.json'];

function die(message, code = 1) { const error = new Error(message); error.code = code; throw error; }
function present(file) { try { fs.lstatSync(file); return true; } catch { return false; } }
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function fileHash(file) { return digest(fs.readFileSync(file)); }
function safeRelative(value) {
  const clean = String(value).replace(/\\/g, '/').replace(/^\.\//, '');
  if (!clean || path.isAbsolute(clean) || clean.includes('\0') || clean.split('/').includes('..')) die(`unsafe path: ${value}`, 2);
  return clean;
}
function within(target, relative) {
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
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.agentic-tmp-${process.pid}`;
  fs.writeFileSync(temp, value, 'utf8'); fs.renameSync(temp, file);
}
function json(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { __error: e.message }; } }
function stable(value) { return value === undefined ? '__undefined__' : JSON.stringify(value, null, 2); }

function args(argv) {
  const result = { command: 'install', target: null, profile: 'core', harnesses: new Set(['claude']), dryRun: false, json: false, yes: false, writeConflicts: false, enableHooks: false, strict: false, mcp: undefined, graphPath: 'graphify-out/graph.json', serverName: 'graphify', format: 'text', ticket: null, handoffAction: null, help: false, version: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]; const take = () => { const v = argv[++i]; if (!v || v.startsWith('-')) die(`${arg} requires a value`); return v; };
    if (arg === '-h' || arg === '--help') result.help = true;
    else if (arg === '-v' || arg === '--version') result.version = true;
    else if (arg === '-n' || arg === '--dry-run') result.dryRun = true;
    else if (arg === '--json') result.json = true;
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
    else if (arg.startsWith('-')) die(`unknown flag: ${arg}`);
    else positional.push(arg);
  }
  if (COMMANDS.has(positional[0])) result.command = positional.shift();
  if (result.command === 'handoff' && ['create', 'list', 'show'].includes(positional[0])) result.handoffAction = positional.shift();
  if (positional.length) result.target = positional.shift();
  if (positional.length) die(`unexpected argument: ${positional[0]}`);
  if (!PROFILES.has(result.profile)) die(`unknown profile: ${result.profile}`);
  if (!['text', 'json'].includes(result.format)) die(`unknown format: ${result.format}`);
  for (const harness of result.harnesses) if (!HARNESSES.has(harness)) die(`unknown harness: ${harness}`);
  return result;
}

function help() {
  console.log(`agentic-init — safe project-local template lifecycle

Usage: agentic-init [install] [target] [options]
       agentic-init <status|doctor|update|repair|uninstall|adopt|scan> [target]
       agentic-init handoff <create|list|show> [target] --ticket <id>

Commands: install, status, doctor, update, repair, uninstall, adopt, scan, handoff
Options: --dry-run --profile minimal|core|strict --harness claude,codex,cursor,copilot
         --all-harnesses --enable-hooks --strict --no-mcp --write-conflicts --yes --json

Use update --dry-run before update. Modified and unknown files are always preserved.`);
}

function sourceFiles(relative, output = []) {
  const source = path.join(ROOT, relative); if (!present(source)) return output;
  if (fs.statSync(source).isFile()) { const clean = safeRelative(relative); if (clean !== STATE) output.push(clean); return output; }
  for (const name of fs.readdirSync(source)) sourceFiles(path.join(relative, name), output);
  return output;
}
function desired(options) {
  const roots = [...BASE];
  if (options.harnesses.has('claude')) roots.push('.claude', 'CLAUDE.md');
  if (options.harnesses.has('codex')) roots.push('.codex');
  if (options.harnesses.has('cursor')) roots.push('.cursor');
  if (options.harnesses.has('copilot')) roots.push('.github');
  const files = new Set(); for (const root of roots) for (const file of sourceFiles(root)) files.add(file);
  if (options.profile !== 'strict') for (const file of [...files]) if (file.startsWith('.agentic/hooks/')) files.delete(file);
  return [...files].sort();
}
function source(relative) { return fs.readFileSync(within(ROOT, relative)); }
function statePath(target) { return within(target, STATE); }
function state(target, optional = false) {
  const file = statePath(target);
  if (!present(file)) { if (optional) return null; die(`no install state at ${STATE}; use install or adopt first`, 3); }
  const value = json(file);
  if (value.__error || value.schemaVersion !== 1 || !value.files || typeof value.files !== 'object') die('invalid or unsupported install state', 2);
  for (const [name, record] of Object.entries(value.files)) {
    safeRelative(name); within(target, name);
    if (!record || !/^[a-f0-9]{64}$/.test(record.installedSha256 || '')) die(`invalid state fingerprint: ${name}`, 2);
  }
  return value;
}
function createState(options, files = {}) {
  const pkg = require(path.join(ROOT, 'package.json'));
  return { schemaVersion: 1, template: { package: pkg.name, version: pkg.version, installedAt: new Date().toISOString() }, target: { path: '.', platform: process.platform }, profile: options.profile, harnesses: [...options.harnesses].sort(), components: { baseWorkflow: true, graphifyMcp: options.profile !== 'minimal' && options.mcp !== false, hooks: options.profile === 'strict', review: options.profile === 'strict', securityScan: options.profile === 'strict', memory: options.profile !== 'minimal' }, files, managedConfiguration: { gitignore: { path: '.gitignore', lines: [] } } };
}
function statusOf(target, relative, record) { const file = within(target, relative); return !present(file) ? 'missing' : fileHash(file) === record.installedSha256 ? 'unchanged' : 'modified'; }
function commandExists(command) { return spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [command]).status === 0; }
function graphServer(options) {
  return commandExists('uv')
    ? { command: 'uv', args: ['run', '--with', 'graphifyy', '--with', 'mcp', '-m', 'graphify.serve', options.graphPath] }
    : { command: process.platform === 'win32' ? 'python' : 'python3', args: ['-m', 'graphify.serve', options.graphPath] };
}

function plannedFiles(target, options, existing) {
  const actions = []; const records = existing ? { ...existing.files } : {};
  for (const relative of desired(options)) {
    const destination = within(target, relative); const content = source(relative); const incoming = digest(content); const owned = records[relative];
    if (!owned && relative === 'CLAUDE.md' && present(destination) && !present(within(target, 'CLAUDE.agentic.md'))) {
      actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: relative, content, reason: 'existing-project-claude-md' });
    } else if (!owned) actions.push(!present(destination) ? { op: 'write', relative, source: relative, content, reason: 'new-template-file' } : { op: 'preserve', relative, reason: 'existing-file-not-owned' });
    else if (statusOf(target, relative, owned) === 'missing') actions.push({ op: 'write', relative, source: owned.source, content, reason: 'missing-owned-file' });
    else if (statusOf(target, relative, owned) === 'modified') actions.push({ op: 'preserve', relative, content, reason: 'customized-file', conflict: options.writeConflicts });
    else if (owned.installedSha256 !== incoming) actions.push({ op: 'write', relative, source: owned.source, content, reason: 'template-update' });
    else actions.push({ op: 'skip', relative, reason: 'already-current' });
  }
  // An existing project CLAUDE.md is never managed. Its generated companion is, so include it
  // in future updates even though it is not a normal source-path destination.
  if (records['CLAUDE.agentic.md']) {
    const record = records['CLAUDE.agentic.md']; const content = source(record.source);
    const found = statusOf(target, 'CLAUDE.agentic.md', record);
    if (found === 'missing') actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'missing-owned-file' });
    else if (found === 'modified') actions.push({ op: 'preserve', relative: 'CLAUDE.agentic.md', content, reason: 'customized-file', conflict: options.writeConflicts });
    else if (record.installedSha256 !== digest(content)) actions.push({ op: 'write', relative: 'CLAUDE.agentic.md', source: record.source, content, reason: 'template-update' });
  }
  return { actions, records };
}
function mcpPlan(target, options, current, uninstall = false) {
  const managed = current && current.managedConfiguration && current.managedConfiguration.mcp;
  if (uninstall && !managed) return null;
  if (!uninstall && (options.profile === 'minimal' || options.mcp === false)) return null;
  const relative = '.mcp.json'; const file = within(target, relative); const name = options.serverName;
  if (uninstall) {
    if (!present(file)) return { op: 'skip-config', relative, reason: 'mcp-file-missing' };
    const parsed = json(file); const found = parsed.mcpServers && parsed.mcpServers[name];
    return parsed.__error ? { op: 'preserve-config', relative, reason: 'invalid-mcp-json' } : digest(stable(found)) === managed.expectedValueSha256 ? { op: 'remove-mcp', relative, name, reason: 'owned-mcp-entry' } : { op: 'preserve-config', relative, reason: 'customized-mcp-entry' };
  }
  const value = graphServer(options); const expectedHash = digest(stable(value));
  if (!present(file)) return { op: 'merge-mcp', relative, name, value, expectedHash, reason: 'new-mcp-file' };
  const parsed = json(file); if (parsed.__error) return { op: 'preserve-config', relative, reason: 'invalid-mcp-json' };
  const found = parsed.mcpServers && parsed.mcpServers[name]; const foundHash = digest(stable(found));
  if (found === undefined || (managed && foundHash === managed.expectedValueSha256 && foundHash !== expectedHash)) return { op: 'merge-mcp', relative, name, value, expectedHash, reason: found === undefined ? 'missing-mcp-entry' : 'owned-mcp-update' };
  return managed && foundHash === managed.expectedValueSha256 ? { op: 'skip-config', relative, reason: 'mcp-current' } : { op: 'preserve-config', relative, reason: 'existing-mcp-entry-not-owned' };
}
function ignorePlan(target, current, uninstall = false) {
  const relative = '.gitignore'; const file = within(target, relative); const lines = present(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  const tracked = current && current.managedConfiguration && current.managedConfiguration.gitignore ? current.managedConfiguration.gitignore.lines : [];
  return (uninstall ? tracked : IGNORE.filter((line) => !lines.includes(line))).map((line) => ({ op: uninstall ? 'remove-ignore' : 'add-ignore', relative, line, reason: uninstall ? 'owned-ignore-line' : 'missing-ignore-line' }));
}
function label(action) { return ({ write: action.reason === 'template-update' ? 'UPDATE' : action.reason.includes('missing') ? 'RESTORE' : 'CREATE', preserve: 'PRESERVE', skip: 'SKIP', 'merge-mcp': 'MERGE', 'remove-mcp': 'REMOVE', 'add-ignore': 'ADD', 'remove-ignore': 'REMOVE', 'preserve-config': 'PRESERVE', 'skip-config': 'SKIP', 'remove-file': 'REMOVE' })[action.op] || action.op.toUpperCase(); }
function show(actions, options) {
  if (options.json) return console.log(JSON.stringify(actions.map(({ content, ...a }) => a), null, 2));
  for (const action of actions) {
    console.log(`${label(action).padEnd(9)} ${action.relative || ''}${action.line ? ` — ${action.line}` : ''} — ${action.reason}`);
    if (action.conflict) console.log(`CONFLICT  ${action.relative}.agentic-new — proposed template version`);
  }
}
function apply(target, actions, options, current, records) {
  if (options.dryRun) return;
  for (const action of actions) {
    const file = action.relative && within(target, action.relative);
    if (action.op === 'write') { write(file, action.content); records[action.relative] = { kind: 'file', source: action.source || action.relative, installedSha256: digest(action.content) }; }
    else if (action.op === 'preserve' && action.conflict) write(`${file}.agentic-new`, action.content);
    else if (action.op === 'merge-mcp') {
      const value = present(file) ? json(file) : {}; if (value.__error) continue;
      value.mcpServers = value.mcpServers && typeof value.mcpServers === 'object' ? value.mcpServers : {}; value.mcpServers[action.name] = action.value;
      write(file, JSON.stringify(value, null, 2) + '\n'); current.managedConfiguration.mcp = { path: action.relative, keys: [`mcpServers.${action.name}`], expectedValueSha256: action.expectedHash };
    } else if (action.op === 'add-ignore') {
      const text = present(file) ? fs.readFileSync(file, 'utf8') : ''; write(file, text + (text && !text.endsWith('\n') ? '\n' : '') + action.line + '\n');
      if (!current.managedConfiguration.gitignore.lines.includes(action.line)) current.managedConfiguration.gitignore.lines.push(action.line);
    } else if (action.op === 'remove-file') { if (present(file)) fs.unlinkSync(file); delete records[action.relative]; }
    else if (action.op === 'remove-mcp') {
      const value = json(file); if (value.__error || !value.mcpServers) continue; delete value.mcpServers[action.name]; if (!Object.keys(value.mcpServers).length) delete value.mcpServers; write(file, JSON.stringify(value, null, 2) + '\n'); delete current.managedConfiguration.mcp;
    } else if (action.op === 'remove-ignore' && present(file)) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); if (lines.filter((line) => line === action.line).length !== 1) continue;
      write(file, lines.filter((line) => line !== action.line).join('\n').replace(/\n*$/, '\n')); current.managedConfiguration.gitignore.lines = current.managedConfiguration.gitignore.lines.filter((line) => line !== action.line);
    }
  }
}
function save(target, value, options) { if (!options.dryRun) write(statePath(target), JSON.stringify(value, null, 2) + '\n'); }

function install(target, options, update = false) {
  if (options.profile === 'strict' && !options.enableHooks) die('strict profile requires --enable-hooks; hooks are optional and require explicit consent');
  const existing = state(target, true); if (update && !existing) die(`no install state at ${STATE}; use adopt or install`, 3);
  const effective = update ? {
    ...options,
    profile: existing.profile,
    harnesses: new Set(existing.harnesses || ['claude']),
    // An update must preserve installation choices. In particular, a project that selected
    // --no-mcp must not gain an MCP entry simply because the new CLI defaults to core.
    mcp: existing.components && existing.components.graphifyMcp ? options.mcp : false,
  } : options;
  const plan = plannedFiles(target, effective, existing); const current = existing || createState(effective, plan.records);
  const actions = [...plan.actions, ...[mcpPlan(target, effective, current), ...ignorePlan(target, current)].filter(Boolean)];
  show(actions, options); apply(target, actions, options, current, plan.records);
  if (!options.dryRun) { current.template.version = require(path.join(ROOT, 'package.json')).version; current.template.installedAt = new Date().toISOString(); save(target, current, options); }
  console.log(options.dryRun ? '\nDry run — no files changed.' : '\nCompleted safely. Run `agentic-init doctor .` for diagnostics.');
}
function report(target, options, doctor = false) {
  const current = state(target); const result = { version: current.template.version, profile: current.profile, unchanged: [], modified: [], missing: [], warnings: [] };
  for (const [relative, record] of Object.entries(current.files)) result[statusOf(target, relative, record)].push(relative);
  const managedMcp = current.managedConfiguration && current.managedConfiguration.mcp;
  if (managedMcp) { const value = json(within(target, managedMcp.path)); if (value.__error) result.warnings.push('.mcp.json is invalid JSON'); }
  if (current.components && current.components.graphifyMcp && !commandExists('graphify') && !commandExists('uv')) result.warnings.push('graphify or uv is not on PATH');
  if (options.json) console.log(JSON.stringify(result, null, 2)); else {
    console.log(`Installed version: ${result.version}\nProfile: ${result.profile}\nOwned files — unchanged: ${result.unchanged.length}, modified: ${result.modified.length}, missing: ${result.missing.length}`);
    for (const name of result.modified) console.log(`WARN  customized file preserved: ${name}`); for (const name of result.missing) console.log(`FAIL  missing owned file: ${name}`); for (const warning of result.warnings) console.log(`WARN  ${warning}`);
  }
  if (doctor && (result.modified.length || result.missing.length || result.warnings.length)) process.exitCode = 2;
}
function repair(target, options) {
  const current = state(target); const actions = [];
  for (const [relative, record] of Object.entries(current.files)) if (statusOf(target, relative, record) === 'missing' && present(within(ROOT, record.source))) actions.push({ op: 'write', relative, content: source(record.source), reason: 'restore-missing-owned-file' });
  show(actions, options); apply(target, actions, options, current, current.files); save(target, current, options); console.log(options.dryRun ? '\nDry run — no files changed.' : '\nRepair completed; customized files were preserved.');
}
function uninstall(target, options) {
  const current = state(target); const actions = [];
  for (const [relative, record] of Object.entries(current.files)) { const found = statusOf(target, relative, record); if (found === 'unchanged') actions.push({ op: 'remove-file', relative, reason: 'pristine-owned-file' }); else if (found === 'modified') actions.push({ op: 'preserve', relative, reason: 'customized-file' }); }
  const effective = { ...options, profile: current.profile, harnesses: new Set(current.harnesses || []) }; actions.push(...[mcpPlan(target, effective, current, true), ...ignorePlan(target, current, true)].filter(Boolean)); show(actions, options);
  if (!options.dryRun && !options.yes) die('uninstall requires --yes; use --dry-run to preview');
  apply(target, actions, options, current, current.files);
  if (!options.dryRun) Object.keys(current.files).length ? save(target, current, options) : fs.unlinkSync(statePath(target));
  console.log(options.dryRun ? '\nDry run — no files changed.' : '\nUninstall completed; customized files were preserved.');
}
function adopt(target, options) {
  if (state(target, true)) die('install state already exists'); const files = {};
  for (const relative of desired(options)) { const file = within(target, relative); if (present(file) && fileHash(file) === digest(source(relative))) files[relative] = { kind: 'file', source: relative, installedSha256: fileHash(file) }; }
  const actions = Object.keys(files).map((relative) => ({ op: 'skip', relative, reason: 'exact-match-adopted' })); show(actions, options); save(target, createState(options, files), options); console.log(options.dryRun ? '\nDry run — no state written.' : `\nAdopted ${actions.length} exact template file(s); all others remain project-owned.`);
}
function scan(target, options) {
  const findings = []; const rules = [['AGT001', /(?:bypass|disable|ignore)\s+(?:all\s+)?(?:safety|approval|guard)/i, 'high', 'Instruction may bypass safeguards.'], ['AGT002', /(?:curl|wget|irm)\b[^\n]*\|\s*(?:sh|bash|powershell|pwsh)/i, 'high', 'Piped remote shell command.'], ['AGT003', /\b(?:rm\s+-rf|Remove-Item\s+.*-Recurse.*-Force)\b/i, 'high', 'Broad destructive command.'], ['AGT004', /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_-]{16,}/i, 'critical', 'Possible literal secret.'], ['AGT005', /uses:\s+[^\s@]+@(?![a-f0-9]{40}\b)/i, 'medium', 'Unpinned GitHub Action.']];
  const files = []; const visit = (file) => { if (!present(file)) return; if (fs.statSync(file).isFile()) files.push(file); else for (const entry of fs.readdirSync(file, { withFileTypes: true })) if (!['memory', 'node_modules', '.git'].includes(entry.name)) visit(path.join(file, entry.name)); };
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.agentic', '.claude', '.codex', '.cursor', '.github', '.mcp.json']) visit(within(target, name));
  for (const file of files) {
    let lines; try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { continue; }
    lines.forEach((line, index) => rules.forEach(([id, pattern, severity, message]) => {
      // Policy files often prohibit a dangerous command. A deterministic scanner must not
      // flag an explicit prohibition as though it were an instruction to execute it.
      const context = `${lines[index - 1] || ''} ${line} ${lines[index + 1] || ''}`;
      const prohibited = id === 'AGT003' && /(?:\b(?:no|never|avoid|don't|do not)\b.{0,180}|\bapproval\b.{0,180})(?:rm\s+-rf|Remove-Item)/i.test(context);
      if (pattern.test(line) && !prohibited) findings.push({ id, severity, file: path.relative(target, file).replace(/\\/g, '/'), line: index + 1, message });
    }));
  }
  if (options.json || options.format === 'json') console.log(JSON.stringify({ findings }, null, 2)); else if (!findings.length) console.log('PASS  no deterministic agent-configuration findings'); else findings.forEach((f) => console.log(`${f.severity.toUpperCase().padEnd(8)} ${f.id} ${f.file}:${f.line} — ${f.message}`));
  if (findings.some((f) => f.severity === 'critical' || (options.strict && f.severity === 'high'))) process.exitCode = 2;
}
function handoff(target, options) {
  const action = options.handoffAction || 'list'; const directory = within(target, '.agentic/memory');
  if (action === 'list') { if (!present(directory)) return console.log('No handoffs.'); return fs.readdirSync(directory).filter((x) => x.endsWith('.md')).forEach((x) => console.log(x)); }
  if (action === 'show') { const name = options.ticket || die('handoff show requires --ticket <file>'); const file = within(target, `.agentic/memory/${name.endsWith('.md') ? name : `${name}.md`}`); if (!present(file)) die(`handoff not found: ${name}`); return process.stdout.write(fs.readFileSync(file, 'utf8')); }
  if (action !== 'create') die(`unknown handoff action: ${action}`);
  const id = options.ticket || die('handoff create requires --ticket <ticket-id>'); const tickets = path.join(target, 'ai-workspace', 'tickets'); const match = present(tickets) && fs.readdirSync(tickets).find((x) => x.startsWith(id) && x.endsWith('.md')); if (!match) die(`ticket not found: ${id}`);
  const header = fs.readFileSync(path.join(tickets, match), 'utf8').split(/^---\s*$/m)[0].trim(); const name = `${id}-${new Date().toISOString().slice(0, 10)}.md`; const content = `---\nformat: agentic-memory-v1\nstatus: proposed\nscope: ticket\ncreated: ${new Date().toISOString()}\nsourceTicket: ${id}\ntags: [handoff]\ntrust: unreviewed\n---\n\n# Handoff: ${id}\n\n## Evidence\n\n${header}\n\n## Reuse guidance\n\nReview the source ticket and current git state before continuing.\n\n## Verification needed\n\nConfirm ticket status, claimed files, and actual working-tree state.\n`;
  if (options.dryRun) console.log(`CREATE    .agentic/memory/${name} — proposed handoff`); else { write(within(target, `.agentic/memory/${name}`), content); console.log(`Created .agentic/memory/${name}`); }
}
function main() {
  const options = args(process.argv.slice(2)); if (options.help) return help(); if (options.version) return console.log(require(path.join(ROOT, 'package.json')).version);
  const target = path.resolve(options.target || process.cwd()); if (!present(target) || !fs.statSync(target).isDirectory()) die(`target directory does not exist: ${target}`);
  if (target === path.resolve(ROOT) && options.command !== 'scan') die('refusing to scaffold the template into itself');
  if (options.command === 'install') return install(target, options); if (options.command === 'update') return install(target, options, true); if (options.command === 'status') return report(target, options); if (options.command === 'doctor') return report(target, options, true); if (options.command === 'repair') return repair(target, options); if (options.command === 'uninstall') return uninstall(target, options); if (options.command === 'adopt') return adopt(target, options); if (options.command === 'scan') return scan(target, options); return handoff(target, options);
}
try { main(); } catch (error) { console.error(`error: ${error.message}`); process.exitCode = error.code || 1; }
