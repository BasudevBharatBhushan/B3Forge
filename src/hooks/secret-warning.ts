// Duplicate of the AGT004 pattern in src/commands/scan.ts (the source of truth). Hooks compile
// separately (tsconfig.hooks.json, rootDir src/hooks) and run standalone in user projects, so
// they cannot import it. test/hooks-and-filters.test.ts fails if the two drift apart.
const SECRET = /-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)['"]?\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/i;

export interface HookResult { level: 'info' | 'warn'; message: string }

function scanText(text: string): HookResult {
  return SECRET.test(text) ? { level: 'warn', message: 'Possible secret detected. Remove it and use environment configuration.' } : { level: 'info', message: 'No common secret pattern detected.' };
}

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => process.stdout.write(JSON.stringify(scanText(input)) + '\n'));
}
export { scanText };
