# Optional Hooks

Hooks are installed only with the `strict` profile and explicit `--enable-hooks` consent.
They are advisory by default: they never edit application source, push Git changes, run database
operations, or execute commands from project instructions. Harness adapters must only register
events the harness actually supports.
