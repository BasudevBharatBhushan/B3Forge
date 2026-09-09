# Contributing

Keep changes small, evidence-backed, and compatible with the template's local-first safety
model. A workflow rule needs a recorded operational reason in `LESSONS.md` before it becomes
permanent policy.

## Development

```bash
npm test
node bin/cli.js --help
node bin/cli.js install <temporary-project> --dry-run
```

Never test lifecycle commands in a real project without first using `--dry-run`. New installer
behavior must preserve a pre-existing `CLAUDE.md`, unknown files, custom `.mcp.json` entries,
and custom `.gitignore` entries.

## Contributions

- Keep harness adapters thin; shared policy belongs in `.agentic/core/`.
- Do not add always-loaded rules or a large agent catalog without a demonstrated need.
- Do not make external services, credentials, global configuration, or daemons a base requirement.
- Preserve user changes on install/update/repair/uninstall; ambiguity is a manual-review outcome.
