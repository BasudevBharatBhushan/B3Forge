// GENERATED from src/hooks/validation-reminder.ts — do not edit
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
function run() {
    return {
        level: 'info',
        message: 'Run the scoped typecheck and lint commands recorded in the project configuration; do not imply tests were run.'
    };
}
if (require.main === module)
    process.stdout.write(JSON.stringify(run()) + '\n');
