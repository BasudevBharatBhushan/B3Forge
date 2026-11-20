# Changelog

## 0.3.0 — 2026-11-20

### Added

- Behavior book (`ai-workspace/behavior/`): the project's current behavior as WHEN/THEN rules, merged in ticket by ticket.
- Ticket section B7 "Behavior changes", approved with the plan.
- `validate` command: checks tickets, `active-tickets`, and the behavior book against the ticket process; `--ticket T-NNN` checks one, and `--closing` (with `--ticket`) checks it as if COMPLETED. Tickets from 0.2 get a single "legacy ticket" warning and skip B7/behavior-book checks. Exit 0 no errors (warnings allowed), 1 errors, 2 bad usage or unknown ticket. `/close-ticket` runs `--closing` after merging B7, before COMPLETED.
- Skills `/ticket`, `/discovery`, `/dispatch`, `/resume`, `/close-ticket`; `.agents/rules/topology.md`.
- `b3forge` bin alias (`agentic-init` kept).
- Black-box CLI test suite and CI.

### Changed

- **Breaking:** Node 22 or newer is required.
- **Breaking:** ticket sections renumbered. B7 is now "Behavior changes"; "Decisions & Blockers" moved to B8.
- `CLAUDE.md` slimmed from 22,351 to 7,131 bytes (~5,500 to ~1,800 tokens per session); procedures moved into on-demand skills.
- CLI and hooks rewritten in TypeScript. Compiled `dist/` is committed.

### Fixed

- `update` now refreshes recorded fingerprints after rewriting a file.
- `scan` rule AGT004 detects quoted JSON secret keys.
- The CI workflow is no longer shipped into user projects.
- Local worktrees and local settings are no longer picked up by the installer.

### Migration

- Run `update . --write-conflicts`, copy your §0 values into the new `CLAUDE.md`, and replace yours. See "Migrating from 0.2" in `SETUP.md`.
- Existing tickets keep their old numbering; new tickets use the new one. `validate` warns on old tickets and skips their B7 checks.

## 0.2.0 — 2026-09-09

- Added cross-harness instructions and project adapters for Claude Code, Codex, Cursor, and GitHub Copilot.
- Added safe local lifecycle commands: install, status, doctor, update, repair, uninstall, adopt, scan, and handoff.
- Added optional review, security, research, build-fix, lesson, hook, memory, and TypeScript-pack assets.

## 0.1.0

- Initial ticket-driven, graph-first, Claude-focused template.
