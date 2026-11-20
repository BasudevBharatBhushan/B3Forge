// Build step: prepend the "GENERATED" notice as the first line of each compiled hook.
// Run after `tsc -p tsconfig.hooks.json`. Idempotent and deterministic.
import * as fs from 'node:fs';
import * as path from 'node:path';

const dir = path.resolve(__dirname, '..', '..', '.agentic', 'hooks');
for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  const file = path.join(dir, name);
  const header = `// GENERATED from src/hooks/${name.replace(/\.js$/, '.ts')} — do not edit\n`;
  const text = fs.readFileSync(file, 'utf8');
  if (!text.startsWith(header)) fs.writeFileSync(file, header + text);
}
