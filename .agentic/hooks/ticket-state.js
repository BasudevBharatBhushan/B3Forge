'use strict';

const fs = require('fs');
const path = require('path');

function run(target) {
  const registry = path.join(target, 'ai-workspace', 'active-tickets');
  if (!fs.existsSync(registry)) return { level: 'info', message: 'No active ticket registry.' };
  const content = fs.readFileSync(registry, 'utf8');
  if (/\|\s*T-\d+.*\[~\]|dispatched.*unverified/i.test(content)) {
    return { level: 'warn', message: 'An active ticket may have an unverified dispatched subtask; reconcile ticket and git state.' };
  }
  return { level: 'info', message: 'No stale dispatched ticket state detected.' };
}

if (require.main === module) process.stdout.write(JSON.stringify(run(process.cwd())) + '\n');
module.exports = { run };
