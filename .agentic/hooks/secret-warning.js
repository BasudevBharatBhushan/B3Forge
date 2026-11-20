// GENERATED from src/hooks/secret-warning.ts — do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanText = scanText;
const SECRET = /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|(?:api[_-]?key|secret|token)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{16,})/i;
function scanText(text) {
    return SECRET.test(text) ? { level: 'warn', message: 'Possible secret detected. Remove it and use environment configuration.' } : { level: 'info', message: 'No common secret pattern detected.' };
}
if (require.main === module) {
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    process.stdin.on('end', () => process.stdout.write(JSON.stringify(scanText(input)) + '\n'));
}
