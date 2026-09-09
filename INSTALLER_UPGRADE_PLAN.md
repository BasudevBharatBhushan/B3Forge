# Installer Upgrade Plan

## 1. Purpose

Upgrade `agentic-init` from a one-time scaffolder into a **safe lifecycle manager** for this template.

The upgraded installer must be able to install selected template components, inspect an existing installation, upgrade it without destroying local customizations, repair known installer-owned files, and remove only files it can prove it owns.

The priority is safety over convenience:

> If ownership or user intent is uncertain, preserve the file and explain what needs manual review.

This borrows the useful lifecycle model from ECC, but keeps this project deliberately small: no global daemon, no large component marketplace, and no automatic destructive changes.

## 2. Current State

`bin/cli.js` currently provides a good first-install experience:

- Copies the base payload (`.agents/`, `.claude/`, `ai-workspace/`, `LESSONS.md`, `SETUP.md`).
- Preserves an existing `CLAUDE.md` by creating `CLAUDE.agentic.md`.
- Merges a Graphify MCP server into `.mcp.json`.
- Appends safe ignore entries to `.gitignore`.
- Supports `--dry-run`, `--force`, and Graphify configuration flags.

It does not retain enough state to safely answer these questions later:

- Which files did this tool create?
- Which version of the template was installed?
- Has an installed file been edited by the project owner?
- Which optional features were selected?
- Is the graph/MCP/skill installation still usable?
- Can a missing file be restored without overwriting a customization?
- Which files may be deleted during uninstall?

## 3. Goals and Non-Goals

### Goals

1. Make installation, diagnosis, update, repair, and uninstall explicit commands.
2. Track installer ownership and content fingerprints locally in the target project.
3. Never silently overwrite a user-modified file during update or repair.
4. Never delete a file during uninstall unless the installer can prove that it owns the exact unmodified file.
5. Keep all operations idempotent: running the same command twice should not duplicate configuration or create drift.
6. Work on Windows, macOS, and Linux using Node.js only.
7. Keep the existing simple invocation working as an alias for `install`.

### Non-Goals (v1)

- Managing a global `~/.claude`, `~/.codex`, or editor installation.
- Automatically installing external tools such as `uv`, Python, Graphify, or Git.
- Resolving arbitrary three-way text merges automatically.
- Deleting empty parent directories that may contain user content.
- Replacing the project workflow or adding ECC's broad skill/agent catalog.
- Running code tests or modifying source code in the target project.

## 4. User Experience and Command Surface

The binary remains `agentic-init`. The first non-flag argument becomes an optional command; omitted command means `install` for backwards compatibility.

```text
agentic-init [install] [target] [options]
agentic-init doctor [target] [options]
agentic-init update [target] [options]
agentic-init repair [target] [options]
agentic-init uninstall [target] [options]
agentic-init status [target] [options]
```

### 4.1 `install`

Installs the selected components and writes an ownership manifest.

```bash
# Existing usage remains valid
npx agentic-development-template

# Explicit form
npx agentic-development-template install .

# Minimal install: operating manual and ticket workflow only
npx agentic-development-template install . --profile minimal

# Default core install with Graphify MCP integration
npx agentic-development-template install . --profile core

# Preview every file and configuration change
npx agentic-development-template install . --dry-run
```

Default profile: `core`.

| Profile | Components |
|---|---|
| `minimal` | core operating manual, rules, ticket workspace, skills, `LESSONS.md`, `SETUP.md` |
| `core` | `minimal` plus Graphify MCP setup and Graphify-skill discovery attempt |
| `strict` | `core` plus optional future validation hooks; it must request explicit confirmation before creating hooks |

Initially, `strict` may return a clear “not yet implemented” message. Do not create placeholder hooks until their behavior is designed and tested.

### 4.2 `status`

Read-only, quick summary for people and CI:

```text
agentic development template
Installed version: 0.2.0
State format: 1
Profile: core
Target: E:\work\my-app

Owned files: 24
  unchanged: 21
  modified: 2
  missing: 1

Integrations:
  Graphify MCP: configured; command unavailable
  Graphify skill: not managed (Graphify was unavailable at install time)

Next: agentic-init doctor .
```

Exit codes:

| Code | Meaning |
|---:|---|
| 0 | Installation exists and no drift is detected. |
| 1 | Invocation, input, or filesystem error. |
| 2 | Installation exists but has warnings/drift/missing dependencies. |
| 3 | No installer state exists in this target. |

### 4.3 `doctor`

Read-only diagnostic command. It validates ownership records, files, configuration syntax, selected integrations, and tool availability. It must never change files.

```bash
agentic-init doctor .
agentic-init doctor . --json
```

Checks:

1. The state file parses and has a supported schema version.
2. Every recorded file is present, unchanged, modified, or missing.
3. Recorded fingerprints are valid SHA-256 hex strings.
4. `.mcp.json`, when managed, is valid JSON and contains the expected Graphify entry.
5. `.gitignore`, when managed, still has the individual entries the installer added.
6. Graphify is present on `PATH` when the profile requires it.
7. The expected generated skills and template files exist.
8. No state entry resolves outside the target directory.

Example output:

```text
PASS  state file is valid (format 1)
PASS  21 managed files are unchanged
WARN  CLAUDE.md is project-owned; template companion is CLAUDE.agentic.md
WARN  .claude/skills/testing/SKILL.md differs from installed fingerprint
FAIL  .agents/templates/TICKET_TEMPLATE.md is missing
WARN  graphify is not on PATH; the MCP entry was retained

Run `agentic-init repair . --dry-run` to preview safe restorations.
```

### 4.4 `update`

Updates an existing installation to the package version currently running.

```bash
agentic-init update . --dry-run
agentic-init update .
agentic-init update . --write-conflicts
```

Rules:

- An unchanged installer-owned file may be replaced by the new template version.
- A missing installer-owned file may be recreated.
- A changed installer-owned file is preserved.
- With `--write-conflicts`, write the proposed new template beside the local file as `<filename>.agentic-new`; never overwrite the original.
- Project-owned files, including a pre-existing `CLAUDE.md`, are never overwritten.
- Configuration merges only touch the named entry owned by this tool; unrelated JSON keys stay byte-for-byte semantically intact.
- State is updated only for files successfully created or updated. A modified file retains its original installed fingerprint so future checks still identify it as customized.

`update` must refuse targets without installer state and direct the user to `install` or `adopt` (see Section 10).

### 4.5 `repair`

Restores only files that are missing or corrupted **and are still demonstrably installer-owned**.

```bash
agentic-init repair . --dry-run
agentic-init repair .
agentic-init repair . --component graphify
```

Rules:

- Restore a missing recorded file.
- Restore a file only if its current fingerprint exactly matches a known corrupt/partial write marker created by a failed earlier installer operation. In v1, treat any ordinary mismatch as user-modified and preserve it.
- Re-add a missing Graphify key only when `.mcp.json` is valid JSON and the state says this installer owns that key.
- Re-add individual `.gitignore` entries that the state says this installer added, without replacing the file.
- Never run package installs, initialize a repository, or modify unrelated tool configuration.

### 4.6 `uninstall`

Removes installer-owned content conservatively. `--dry-run` is mandatory unless the user passes `--yes`.

```bash
agentic-init uninstall . --dry-run
agentic-init uninstall . --yes
```

Rules:

- Delete a regular file only if its current SHA-256 equals the installed fingerprint.
- Remove only exact installer-owned keys from `.mcp.json`; preserve all other servers and settings.
- Remove only exact installer-added lines from `.gitignore`; preserve comments and unrelated ignore rules.
- Preserve a changed managed file and report it as “requires manual removal.”
- Preserve parent directories unless the installer can prove they are empty after removal.
- Delete `.agentic/install-state.json` only after the uninstall process completes. Preserve `.agentic/` if it contains unknown user files.

## 5. Installation-State Design

Add this directory to every managed target:

```text
.agentic/
  install-state.json
```

Add `.agentic/` to the generated `.gitignore` by default. The state is machine-local management metadata and should not be part of application source control. A future team-managed mode can opt in to committing it.

### 5.1 State schema, version 1

```json
{
  "schemaVersion": 1,
  "template": {
    "package": "agentic-development-template",
    "version": "0.2.0",
    "installedAt": "2026-09-09T10:30:00.000Z"
  },
  "target": {
    "path": ".",
    "platform": "win32"
  },
  "profile": "core",
  "components": {
    "baseWorkflow": true,
    "graphifyMcp": true,
    "graphifySkill": false,
    "hooks": false
  },
  "files": {
    ".agents/rules/rules.md": {
      "kind": "file",
      "installedSha256": "<64-character-sha256>",
      "source": ".agents/rules/rules.md"
    },
    "CLAUDE.agentic.md": {
      "kind": "file",
      "installedSha256": "<64-character-sha256>",
      "source": "CLAUDE.md",
      "reason": "existing-project-claude-md"
    }
  },
  "managedConfiguration": {
    "mcp": {
      "path": ".mcp.json",
      "keys": ["mcpServers.graphify"],
      "expectedValueSha256": "<sha256-of-canonical-json-value>"
    },
    "gitignore": {
      "path": ".gitignore",
      "lines": ["graphify-out/", "temp/", "tmp/", ".agentic/"]
    }
  }
}
```

Important details:

- Store paths relative to the target only, using POSIX `/` separators.
- Reject absolute paths, `..` traversal, null bytes, or paths resolving outside the target.
- Store a fingerprint for file content, not timestamps. Timestamps are unreliable across checkouts and archive extraction.
- The installer must atomically write state: write a sibling temporary state file, then rename it after all successful changes.
- Do not store secrets, environment values, complete MCP configuration, or user machine paths in the state file.

### 5.2 Ownership categories

| Category | Example | Update / repair / uninstall behavior |
|---|---|---|
| Installer-owned file | `.agents/rules/rules.md` created by install | Change if fingerprint is unchanged; otherwise preserve. |
| Installer companion | `CLAUDE.agentic.md` created because `CLAUDE.md` existed | Same as installer-owned; never assume ownership of `CLAUDE.md`. |
| Project-owned file with managed fragment | `.mcp.json`, `.gitignore` | Change or remove only recorded fragment/key. |
| External integration | Global Graphify skill installed by Graphify CLI | Do not claim ownership unless an external tool provides a stable ownership contract. Record status only. |
| Unknown file | Any other file under `.claude`, `.agents`, or `.agentic` | Never overwrite or delete. |

## 6. Safe File and Configuration Algorithms

### 6.1 File classification

For every state file record:

```text
if file does not exist                 => MISSING
else if sha256(file) == installed hash => UNCHANGED
else                                   => MODIFIED
```

The original `installedSha256` never changes merely because a file is modified. It changes only when the installer safely writes a new template version.

### 6.2 Planned-action model

Every mutating command must first build a complete in-memory action plan.

```js
{
  action: 'write-file' | 'remove-file' | 'merge-mcp-key' | 'remove-mcp-key' |
          'add-gitignore-line' | 'remove-gitignore-line' | 'skip',
  path: '.agents/templates/TICKET_TEMPLATE.md',
  reason: 'missing-installer-owned-file',
  safety: 'safe' | 'requires-confirmation' | 'preserved-user-change'
}
```

Then:

1. Display the plan in human-readable form.
2. In `--dry-run`, stop successfully without writes.
3. In a real command, apply only safe actions.
4. Write the updated state atomically.
5. Run the relevant in-process validation checks.
6. Print a summary of applied, skipped, and manual-review actions.

This makes dry runs trustworthy and enables JSON output later without duplicating decision logic.

### 6.3 JSON merge behavior

`.mcp.json` is a project-owned JSON document. The installer may only manage the configured Graphify server key.

Install/update:

1. If no `.mcp.json` exists, create `{ "mcpServers": { "graphify": ... } }`.
2. If it is invalid JSON, leave it untouched and report an actionable error.
3. If the requested key is absent, add it.
4. If the key equals the recorded tool-owned value, it may be updated.
5. If the key differs from the recorded value, preserve it and report a conflict.
6. Preserve all unrelated JSON properties.

Uninstall:

1. Parse JSON; if invalid, preserve it and report manual cleanup.
2. Remove only the recorded nested key when it still matches the recorded canonical value.
3. Remove an empty `mcpServers` object only if it became empty because of this removal.
4. Never remove the whole `.mcp.json` except when state records that this installer created it, it has no other properties, and it still exactly matches the installer-created content.

### 6.4 `.gitignore` merge behavior

Track individual lines, not a whole appended block. An exact installer heading is useful for readability but is not ownership proof.

- Add missing exact lines once.
- Preserve comments, ordering, blank lines, user edits, and other rules.
- On uninstall, remove only an exact line that is recorded and appears exactly once in the file.
- If a line appears more than once, preserve all copies and flag ambiguity rather than guessing which one the installer added.

## 7. Code Structure

Refactor `bin/cli.js` into small CommonJS modules. Continue to ship no runtime dependencies.

```text
bin/
  cli.js                       # Parse command and render output only
  lib/
    args.js                    # Command-specific parsing and help text
    constants.js                # Profiles, payload inventory, schema version
    filesystem.js               # Atomic writes, safe relative paths, SHA-256
    state.js                    # Read, validate, write install-state.json
    inventory.js                # Desired files/config by profile and platform
    planner.js                  # Pure install/update/repair/uninstall action planner
    executor.js                 # Applies a verified action plan
    integrations.js             # Graphify detection and MCP value construction
    doctor.js                   # Read-only diagnostics
    output.js                   # Text/JSON result formatting
test/
  conformance.js                # Existing high-level checks
  installer.test.js             # Lifecycle/fixture tests
  fixtures/
    existing-claude-project/
    modified-install/
    invalid-mcp/
```

### 7.1 Core functions

```js
createDesiredInventory({ profile, graphPath, serverName, capabilities })
readInstallState(target)
validateInstallState(state, target)
classifyManagedFile(target, fileRecord)
planInstall(target, desiredInventory, existingState)
planUpdate(target, desiredInventory, state)
planRepair(target, desiredInventory, state)
planUninstall(target, state)
executePlan(target, plan, { dryRun })
runDoctor(target, state, desiredInventory)
```

The planner functions must be as close to pure functions as practical: accept a filesystem snapshot and return actions. This makes safety logic testable without writing real files.

## 8. Implementation Phases

### Phase 0 — Correct existing wording and establish baseline

Scope:

- Fix the CLI wording that says merge sections “0–12”; the manual currently ends at §11.
- Add a package version helper and a `--version` assertion to tests.
- Preserve current flags and behavior.

Acceptance:

- Existing `npm test` remains green.
- Current `npx ... [target] [flags]` behavior still works.

### Phase 1 — State-aware install and status

Scope:

- Add command parsing with default `install` command.
- Implement `.agentic/install-state.json` schema validation and atomic writes.
- Record every copied file and managed configuration fragment.
- Add `status`.
- Add `.agentic/` to the installer-managed `.gitignore` entries.

Acceptance:

- Fresh install creates valid state with fingerprints.
- Re-running install produces no duplicated files/configuration.
- Existing user `CLAUDE.md` remains untouched and companion-file ownership is correctly tracked.
- `status` distinguishes unchanged, modified, and missing files.

### Phase 2 — Doctor

Scope:

- Implement all checks in Section 4.3.
- Add `--json` output with stable fields suitable for CI.
- Define/document exit codes.

Acceptance:

- A clean fixture returns exit code 0.
- A modified file returns warnings and exit code 2.
- An invalid state file returns a clear error without writes.
- An invalid `.mcp.json` is reported but never altered.

### Phase 3 — Safe update and conflict artifacts

Scope:

- Implement desired inventory comparison against state.
- Update unchanged files; restore missing ones.
- Preserve modified files.
- Add `--write-conflicts` to generate `*.agentic-new` files only on request.

Acceptance:

- Updating a clean installation changes expected template files and state fingerprints.
- Updating a modified skill preserves it.
- `--write-conflicts` creates a proposed replacement without modifying the customized file.
- A dry run has no filesystem side effects.

### Phase 4 — Repair and uninstall

Scope:

- Implement conservative restoration of missing files.
- Implement configuration-fragment repair.
- Add mandatory uninstall preview unless `--yes` is given.
- Implement safe exact-match deletion and state cleanup.

Acceptance:

- Repair restores a deleted, installer-owned file.
- Repair does not replace a modified file.
- Uninstall removes a pristine install.
- Uninstall preserves user-modified files and unrelated MCP/gitignore content.
- Uninstall is idempotent; a second invocation reports no managed installation rather than failing destructively.

### Phase 5 — Optional integrations and strict profile

Scope:

- Design separately, then add hook support behind `--profile strict` and an explicit `--enable-hooks` confirmation.
- Add harness adapters only after the shared workflow has a provider-neutral source of truth.

This phase is intentionally separate. It should not block lifecycle safety.

## 9. Test Plan

The current conformance test is a good smoke test but needs a lifecycle-focused suite.

### 9.1 Test matrix

| Scenario | Expected result |
|---|---|
| Fresh core install | Writes selected files, MCP entry, gitignore entries, and state. |
| Fresh minimal install | Does not write Graphify MCP configuration. |
| Existing `CLAUDE.md` | Leaves it unchanged; records `CLAUDE.agentic.md`. |
| Re-run same install | No duplicate config/ignore lines; state remains valid. |
| Missing managed file | `doctor` reports it; `repair` restores it. |
| Modified managed file | `doctor` warns; `update`, `repair`, and uninstall preserve it. |
| Invalid `.mcp.json` | No command overwrites it; diagnostic explains manual action. |
| Unrelated MCP server | Survives install/update/repair/uninstall. |
| Modified Graphify MCP key | Is not overwritten or removed. |
| Existing ignore lines | Are not duplicated. |
| Duplicate managed ignore line | Uninstall preserves lines and reports ambiguity. |
| State path traversal | State validation rejects it before any write/delete. |
| Interrupted state write | Existing valid state remains parseable due to atomic write. |
| Dry-run of every mutating command | No file, configuration, or state changes. |
| `--write-conflicts` | Creates only side-by-side proposal files. |
| `uninstall --yes` from clean install | Removes only owned content and leaves unknown files. |

### 9.2 Test implementation approach

- Use a new temp directory per test, as the existing conformance test does.
- Call the actual CLI through `spawnSync` for end-to-end command behavior.
- Also unit-test planner and state functions directly.
- Snapshot the target directory before and after every dry run and assert identical content hashes.
- Simulate user edits by changing a file after install; never create test cases that depend only on timestamp behavior.
- Run tests on Windows and Linux in GitHub Actions once CI is added.

## 10. Migration for Existing Installations

Old installations have no state file, so they are **unmanaged by default**.

Do not infer ownership from familiar filenames alone. A project may have independently created `.claude/skills/testing/SKILL.md` or a custom `CLAUDE.md`.

Provide an explicit adoption preview:

```bash
agentic-init adopt . --dry-run
agentic-init adopt . --yes
```

`adopt` rules:

1. Compare each candidate file against the exact payload content from a selected baseline package version.
2. Only record ownership when the content matches exactly.
3. For `.mcp.json`, only record `mcpServers.graphify` if it exactly matches the expected managed value.
4. For `.gitignore`, record individual expected lines only; never infer ownership of comments/blocks.
5. Print all skipped candidate files and why they were not adopted.
6. Never alter target files during adoption.

If version provenance is unknown, `adopt` should refuse rather than pretending the current package version owns old content.

## 11. Future Cross-Harness Extension

Do not add copied, divergent instructions per harness. First create a provider-neutral source:

```text
.agentic/core/
  workflow.md
  rules.md
  skills/
```

Then have adapters render or link the shared source into:

```text
CLAUDE.md                     # Claude Code
AGENTS.md                     # Codex and general agent harnesses
.github/copilot-instructions.md
.github/prompts/*.prompt.md   # GitHub Copilot
.cursor/rules/*.mdc           # Cursor, if selected
.codex/                       # Codex-specific integration, if selected
```

The installer should treat each harness as an optional component and record its files separately in state. Do not claim feature parity until that tool's behavior is verified on its supported platforms.

## 12. Security Requirements

- Resolve and validate every write/delete path beneath the explicit target before acting.
- Use `lstat` where relevant; do not follow symlinks that escape the target directory.
- Never accept a state file as authority without validating schema, relative paths, and hashes.
- Never execute commands stored in state or project configuration.
- Redact environment values and never include secrets in JSON output.
- Do not mutate external tool configuration, user home directories, Git configuration, or environment files.
- Require `--yes` for a real uninstall; do not let `--force` imply deletion permission.
- Ensure all destructive action plans are printed before execution.

## 13. Definition of Done

The installer upgrade is complete when:

1. `install`, `status`, `doctor`, `update`, `repair`, and `uninstall` are documented and implemented.
2. The installer writes and validates a versioned, local ownership manifest.
3. All lifecycle actions are idempotent and have a trustworthy dry-run.
4. Modified or ambiguous user files are preserved in every command.
5. MCP and `.gitignore` changes are fragment-level, not whole-file destructive.
6. `npm test` includes the lifecycle matrix above.
7. CI runs the test suite on Windows and Linux.
8. The README and setup guide include a short lifecycle section and safe recovery examples.
9. A clean uninstall leaves no installer-owned files while preserving user-owned/modified content.

## 14. Recommended First Implementation Ticket

Start with Phase 1 only. It produces the foundation every later command depends on.

**Ticket title:** Add installation state and status command

**Files likely to change:**

- `bin/cli.js` (initially; extract modules only if the patch becomes difficult to review)
- `package.json`
- `README.md`
- `SETUP.md`
- `test/conformance.js`
- new `test/installer.test.js`

**Acceptance criteria:**

1. Existing install command stays compatible.
2. Fresh install creates `.agentic/install-state.json` with SHA-256 fingerprints.
3. `agentic-init status <target>` reports installation version, profile, and file drift.
4. `--dry-run` creates no state file.
5. Existing `CLAUDE.md` is still preserved exactly.
6. Re-running an install does not duplicate `.mcp.json` keys or `.gitignore` lines.
7. All tests pass.

Do not begin update, repair, or uninstall until the state data and its tests are solid.
