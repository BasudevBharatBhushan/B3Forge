import * as fs from 'node:fs';
import * as path from 'node:path';
import { present, within } from '../fs-safe';
import type { Options } from '../types';

interface Finding { id: string; severity: string; file: string; line: number; message: string }
type Rule = [id: string, pattern: RegExp, severity: string, message: string];

export function scan(target: string, options: Options): void {
  const findings: Finding[] = []; const rules: Rule[] = [['AGT001', /(?:bypass|disable|ignore)\s+(?:all\s+)?(?:safety|approval|guard)/i, 'high', 'Instruction may bypass safeguards.'], ['AGT002', /(?:curl|wget|irm)\b[^\n]*\|\s*(?:sh|bash|powershell|pwsh)/i, 'high', 'Piped remote shell command.'], ['AGT003', /\b(?:rm\s+-rf|Remove-Item\s+.*-Recurse.*-Force)\b/i, 'high', 'Broad destructive command.'], ['AGT004', /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)['\"]?\s*[:=]\s*['\"]?[A-Za-z0-9_-]{16,}/i, 'critical', 'Possible literal secret.'], ['AGT005', /uses:\s+[^\s@]+@(?![a-f0-9]{40}\b)/i, 'medium', 'Unpinned GitHub Action.']];
  const files: string[] = []; const visit = (file: string): void => { if (!present(file)) return; if (fs.statSync(file).isFile()) files.push(file); else for (const entry of fs.readdirSync(file, { withFileTypes: true })) if (!['memory', 'node_modules', '.git'].includes(entry.name)) visit(path.join(file, entry.name)); };
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.agentic', '.claude', '.codex', '.cursor', '.github', '.mcp.json']) visit(within(target, name));
  for (const file of files) {
    let lines: string[]; try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch { continue; }
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
