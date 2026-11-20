function run(): { level: 'info'; message: string } {
  return {
    level: 'info',
    message: 'Run the scoped typecheck and lint commands recorded in the project configuration; do not imply tests were run.'
  };
}

if (require.main === module) process.stdout.write(JSON.stringify(run()) + '\n');
export { run };
