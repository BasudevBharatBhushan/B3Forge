# Agentic Development Template — Complete Enhancement Plan

## 1. Outcome

Evolve this repository from a Claude-focused starter scaffold into a **small, safe, cross-harness development system**. It should retain the current advantages—minimal context, one ticket per task, graph-first discovery, file ownership, and explicit model tiers—while adding the high-value operational capabilities found in ECC:

```text
shared workflow
  + safe installer lifecycle
  + harness adapters
  + optional deterministic checks
  + independent review and security checks
  + durable, human-approved learning
  + CI-tested releases
```

This is not a plan to copy ECC's hundreds of agents, skills, commands, or global runtime. The template should be more capable without becoming a heavyweight framework that every project must load.

## 2. Design Principles

Every enhancement must satisfy these rules.

1. **Minimal by default.** A new capability is an optional component unless it is needed for every project.
2. **One source of truth.** Shared workflow rules must not be copied and allowed to drift across Claude, Codex, Cursor, and Copilot.
3. **Evidence beats claims.** Hooks, diagnostics, review reports, and test output are evidence; a model saying “done” is not.
4. **Human approval for durable changes.** A proposed lesson, rule, or skill is not automatically made permanent.
5. **Safe ownership.** The installer never overwrites or deletes a file it cannot prove it owns.
6. **Local-first.** No external service, telemetry, background process, API key, or global configuration should be required for the base template.
7. **Composable, not mandatory.** Teams can choose a minimal, core, or strict profile.
8. **Test the template as a product.** Generated projects and configuration merges need automated tests, not only prose review.

## 3. Capability Gap Matrix

| Workstream | Current template | Enhancement to implement | Priority |
|---|---|---|---|
| Shared instructions | `CLAUDE.md` is the single operating manual | Provider-neutral core plus thin Claude/Codex/Cursor/Copilot adapters | P0 |
| Installation lifecycle | Install/scaffold only | Install state, status, doctor, update, repair, uninstall, adoption | P0 |
| Verification of this repository | Local conformance test only | Unit/integration tests, GitHub Actions, release checks | P0 |
| Runtime enforcement | Prompt/manual gates | Opt-in hooks for validation, ticket state, graph freshness, secret warnings | P1 |
| Review | Orchestrator reads diffs | Dedicated read-only reviewer role and review report format | P1 |
| Security | Safety guidance in the manual | Agent/config scanner and optional code security-review skill | P1 |
| Knowledge retention | `LESSONS.md`, tickets, module docs | Reviewable memory/handoff and lesson-candidate workflow | P2 |
| Task workflows | Seven Claude skills, two implementation agents | Small cross-harness core catalog: planning, research, review, build-fix, security | P2 |
| Stack support | Generic frontend/backend/database rules | Optional language packs, starting with JavaScript/TypeScript | P2 |
| Plan approval UX | Markdown ticket approval | Optional local plan viewer after core work is stable | P3 |
| Project maturity | README/SETUP only | Contributing guide, changelog, license verification, security policy, release notes | P2 |

## 4. Target Architecture

### 4.1 Repository layout after completion

```text
AGENTS.md                              Universal entry point for agent harnesses
CLAUDE.md                              Claude adapter; references shared content
README.md
SETUP.md
CHANGELOG.md
CONTRIBUTING.md
SECURITY.md
LICENSE

.agentic/
  core/
    operating-manual.md                Canonical workflow and safety rules
    task-types.md                      Type/scope taxonomy
    review-contract.md                 Review evidence and result format
    memory-format.md                   Portable local handoff/decision format
  manifests/
    components.json                    Optional component inventory
  adapters/
    claude/
    codex/
    cursor/
    copilot/
  hooks/
    README.md
    ticket-state.js
    graph-freshness.js
    secret-warning.js
    validation-reminder.js
  skills/
    plan/
    research/
    review/
    security-review/
    build-fix/
    testing/
    refactor/
    lesson-review/
  memory/                              Runtime-only; ignored by default
  install-state.json                   Runtime-only; ignored by default

.agents/                               Compatibility/deep-reference documents
.claude/                               Claude-specific generated adapter surface
.codex/                                Codex-specific generated adapter surface
.cursor/                               Cursor-specific generated adapter surface
.github/
  workflows/
    ci.yml
    release.yml
  copilot-instructions.md
  prompts/
    plan.prompt.md
    review.prompt.md
    security-review.prompt.md
    build-fix.prompt.md

bin/
  cli.js
  lib/                                 Installer, planner, doctor, scanner helpers

test/
  conformance.js
  installer.test.js
  adapters.test.js
  hooks.test.js
  scanner.test.js
  fixtures/
```

`AGENTS.md` and `CLAUDE.md` must be generated or maintained from the same canonical rules. They may contain tool-specific instructions, but they may not contain independent copies of the workflow.

### 4.2 Component model

Each optional capability is represented by a small manifest entry rather than hard-coded branching scattered throughout the installer.

```json
{
  "id": "security-scan",
  "version": 1,
  "profiles": ["strict"],
  "dependsOn": ["base-workflow"],
  "files": [
    ".agentic/skills/security-review/SKILL.md",
    ".agentic/hooks/secret-warning.js"
  ],
  "harnesses": ["claude", "codex", "cursor", "copilot"],
  "requiresExplicitConsent": true
}
```

The manifest enables the installer to calculate a deterministic desired inventory, explain what a profile will install, and record ownership accurately.

### 4.3 Profiles

| Profile | Intended user | Included components |
|---|---|---|
| `minimal` | A team wanting only the ticket workflow | core instructions, tickets, basic skills, no MCP/hook runtime |
| `core` | Default project setup | minimal + Graphify MCP configuration and cross-harness adapter selected by the user |
| `strict` | A mature repository with CI | core + opt-in hooks, security scanning, reviewer workflow, CI templates |

Profiles only select components. They must not silently install global tools, grant permissions, add external MCP servers, or run a background process.

## 5. Workstream A — Provider-Neutral Workflow and Harness Adapters

### Goal

Allow the same core development process to work in Claude Code, Codex, Cursor, and GitHub Copilot without four drifting copies of the manual.

### Implementation

1. Extract content from `CLAUDE.md` into `.agentic/core/operating-manual.md`.
2. Keep canonical sections tool-neutral: task classification, tickets, discovery, safe actions, ownership, verification, testing policy, and memory policy.
3. Create adapters that only describe how the current harness invokes/loads the core workflow.
4. Make each adapter explicit about capability differences. For example, Copilot prompt files cannot provide hooks or native subagents; do not claim that they can.
5. Generate target harness files during installation. Do not require users to manually synchronize copies.

### Adapter outputs

| Harness | Generated project files | What it should provide |
|---|---|---|
| Claude Code | `CLAUDE.md`, `.claude/agents/`, `.claude/skills/` | Existing tiered implementation agents and discovered skills |
| Codex | `AGENTS.md`, `.codex/` skill/config surface | Shared workflow, roles/skills where supported, safe tool guidance |
| Cursor | `.cursor/rules/`, `.cursor/agents/`, `.cursor/commands/` | Condensed rules and explicit agent definitions |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/prompts/` | Always-loaded core instructions and reusable plan/review/security/build prompts |

### Required file changes

- New `.agentic/core/*` canonical documents.
- New `.agentic/adapters/*` templates/renderers.
- Refactor `CLAUDE.md` into a generated adapter or a concise wrapper with no duplicate policy text.
- Add root `AGENTS.md`.
- Add `.github/copilot-instructions.md` and four prompt files.
- Add harness selection flags: `--harness claude,codex,cursor,copilot` and `--all-harnesses`.

### Acceptance criteria

- The installed core workflow is semantically identical across supported adapters.
- An automated test renders each adapter fixture and checks mandatory rules are present.
- No adapter says it supports a feature unavailable in that harness.
- A modified adapter file is preserved by update/uninstall lifecycle rules.

## 6. Workstream B — Installer Lifecycle

### Goal

Make installation maintainable and reversible rather than a one-way copy operation.

### Features

```bash
agentic-init install [target]
agentic-init status [target]
agentic-init doctor [target]
agentic-init update [target]
agentic-init repair [target]
agentic-init uninstall [target] --dry-run
agentic-init uninstall [target] --yes
agentic-init adopt [target] --dry-run
```

### Required behavior

- Store relative file ownership plus SHA-256 fingerprints in `.agentic/install-state.json`.
- Track only fragments owned in project-owned files such as `.mcp.json` and `.gitignore`.
- Update only pristine owned files; preserve modifications and optionally write `*.agentic-new` proposals.
- Repair missing owned files only.
- Require explicit `--yes` for actual uninstall; preserve ambiguous or user-modified content.
- Make every mutating command plan-first and dry-run capable.
- Validate target paths, state paths, symlinks, and JSON before every write/delete.

### Detailed specification

See [INSTALLER_UPGRADE_PLAN.md](INSTALLER_UPGRADE_PLAN.md) for the state schema, safe merge algorithms, command outputs, migration/adoption path, and test matrix.

### Acceptance criteria

- A clean install can update and uninstall cleanly.
- Any user-modified owned file survives update, repair, and uninstall.
- Unrelated MCP and ignore rules survive every lifecycle operation.
- Legacy installs without state are never assumed to be tool-owned.

## 7. Workstream C — CI, Testing, and Release Engineering

### Goal

Treat this template as a package that generates critical engineering process, so every release is tested across the lifecycle.

### C1. Test suite changes

Keep the existing conformance test and add:

| Test file | Purpose |
|---|---|
| `test/installer.test.js` | Fresh install, update, repair, uninstall, dry run, ownership, invalid state/config |
| `test/adapters.test.js` | Rendered harness adapters contain expected core policy and retain harness-specific boundaries |
| `test/hooks.test.js` | Hook inputs, no-op defaults, strict profile activation, error handling |
| `test/scanner.test.js` | Known safe and unsafe configuration fixtures produce expected findings |
| `test/docs.test.js` | Internal links, documented commands/options, version references, required repository files |

All tests should use temporary fixture repositories and call the CLI as a user would. Unit tests can cover pure planner/renderer/scanner functions, but end-to-end fixture tests are mandatory.

### C2. GitHub Actions

Add `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
        node: [20, 22]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run lint
      - run: npm run check:docs
```

Add package scripts:

```json
{
  "test": "node --test test/*.test.js && node test/conformance.js",
  "lint": "eslint .",
  "format:check": "prettier --check .",
  "check:docs": "node scripts/check-docs.js",
  "check": "npm run format:check && npm run lint && npm test && npm run check:docs"
}
```

Exact tools may differ, but use pinned dev dependencies and do not make CI call globally installed tools.

### C3. Release process

1. Maintain `CHANGELOG.md` with Keep-a-Changelog-style sections.
2. Use semantic versioning: patch for fixes/docs, minor for new non-breaking capabilities, major for behavior/ownership-schema breaking changes.
3. Add `npm pack --dry-run` validation to CI to ensure files listed in `package.json` are shipped.
4. Add a release workflow only after npm publishing authority and package name are confirmed.
5. Test the packed tarball, not only the checkout, in a temporary target directory.

### Acceptance criteria

- Every pull request runs on Windows and Linux.
- The packaged artifact installs correctly into a fixture project.
- A failure in CLI behavior, docs links, rendering, or ownership safety blocks merge.

## 8. Workstream D — Optional Runtime Hooks

### Goal

Turn a small set of high-value workflow checks into deterministic evidence without adding always-on noise or unsafe automation.

### Hook policy

- Hooks are off in `minimal` and `core` profiles.
- The `strict` profile requires `--enable-hooks` or interactive confirmation.
- Hooks warn or record state by default; they do not mutate application code, run migrations, push Git changes, or delete files.
- A hook failure must never block a developer from recovering a project unless they explicitly choose a blocking CI mode.

### Initial hook set

| Hook | Trigger | Behavior | Default severity |
|---|---|---|---|
| `ticket-state` | session start/end or command completion | Warn if an active ticket has a stale `[~]` dispatched state; show recovery path | warning |
| `graph-freshness` | commit/checkout if Graphify is configured | Mark graph stale or run an explicitly configured Graphify update command | warning / optional action |
| `secret-warning` | before committing / after editing sensitive extensions | Scan changed text for common private-key/token patterns and warn | warning |
| `validation-reminder` | after source edit | Remind the agent of configured scoped typecheck/lint commands; do not run broad tests silently | info |
| `session-handoff` | session end | Draft a ticket-based handoff candidate, never automatically write canonical memory | info |

### Architecture

Use Node scripts that accept a small JSON event payload on stdin and return structured JSON/text. Keep core logic in normal testable modules; harness scripts are thin adapters.

```text
harness event -> adapter -> .agentic/hooks/<hook>.js -> structured result
```

Each adapter must declare whether the harness actually supports the event. No fake hook support.

### Configuration

```json
{
  "version": 1,
  "profile": "strict",
  "enabled": ["ticket-state", "secret-warning"],
  "graphify": { "mode": "warn" },
  "validation": { "mode": "remind" }
}
```

Keep runtime configuration in `.agentic/config.json`; do not read arbitrary environment or shell commands from project instructions.

### Acceptance criteria

- Default installation creates no hooks.
- A strict installation cannot activate hooks without explicit acknowledgement.
- Hooks have fixture-tested input/output and tolerate absent/invalid optional state safely.
- Hooks do not modify source files or external systems.

## 9. Workstream E — Independent Code Review

### Goal

Formalize the current “orchestrator reads every diff” principle into a repeatable, fresh-context review stage.

### New agent/skill roles

| Role | Access | Responsibility | Cannot do |
|---|---|---|---|
| `reviewer` | Read, search, diff, test output | Find correctness, regression, scope, maintainability, and missing-verification issues | Edit code or approve its own changes |
| `security-reviewer` | Read, search, diff | Find auth, validation, secrets, data exposure, dependency, and permission issues | Edit code or run destructive operations |
| `build-fixer` | Edit, shell within project | Diagnose a confirmed build/type/lint failure and make a minimal repair | Change feature scope or rewrite unrelated code |
| `docs-researcher` | Web/docs read only | Verify current upstream API/library behavior before implementation | Make code edits |

The implementation roles remain `impl-small` and `impl-mid`. Do not create multiple generic implementers with overlapping responsibilities.

### Review workflow

```text
approved ticket
  -> implementation subtasks and local sanity checks
  -> fresh-context reviewer reads ticket, diff, and evidence
  -> findings recorded in ticket under Review
  -> accepted findings repaired through a new file-owned subtask
  -> reviewer confirms resolved findings or records accepted risk
```

### Review report contract

```text
REVIEW: PASS | FINDINGS | BLOCKED
FINDINGS:
- [severity: high|medium|low] file:line — issue, impact, evidence, required change
VERIFICATION GAPS:
- command/test not run, reason
OUT-OF-SCOPE CHANGES:
- file/path — why it appears outside the approved ticket
```

No generic praise, no rewrite of the ticket, and no unprioritized essays.

### Acceptance criteria

- Every non-trivial ticket can invoke `/review` or its harness equivalent.
- The reviewer has a fresh context and read-only toolset.
- Findings are actionable, severity-labeled, and tied to evidence.
- The reviewer does not become a mandatory cost for trivial documentation-only tickets; ticket type/risk controls the requirement.

## 10. Workstream F — Security Scanner and Security Workflow

### Goal

Protect both generated application changes and the agent harness itself.

### F1. Agent configuration scanner

Add a local CLI command:

```bash
agentic-init scan .
agentic-init scan . --format json
agentic-init scan . --strict
```

Scanner targets:

- `CLAUDE.md`, `AGENTS.md`, and agent/skill instructions
- MCP configuration files
- hook configuration/scripts
- generated installer state/configuration
- CI workflow files
- `.env` examples and accidental secret-bearing files

Initial deterministic rules:

| ID | Detect | Severity |
|---|---|---|
| `AGT001` | instruction that asks to disable safeguards or bypass approval | high |
| `AGT002` | remote shell downloader/piped shell command in hooks or instructions | high |
| `AGT003` | broad destructive command without path validation | high |
| `AGT004` | literal token/private-key patterns | critical |
| `AGT005` | unpinned third-party action or executable download in CI | medium |
| `AGT006` | MCP server with embedded credential or unsafe broad filesystem command | high |
| `AGT007` | state/config file path traversal or external write path | high |
| `AGT008` | adapter claims unsupported security/hook capability | medium |

The scanner should be transparent: every finding provides rule ID, file/line, evidence snippet with redaction, remediation, and a documented false-positive suppression comment. It must not auto-edit security findings.

### F2. Security-review skill

Provide an on-demand skill/checklist for feature changes that affect authentication, authorization, payments, file uploads, data exports, external webhooks, multi-tenancy, secrets, or sensitive personal data.

It should require:

1. Threat boundaries and assets.
2. Input and authorization paths.
3. Data storage/transit/logging considerations.
4. Dependency/API review where current behavior matters.
5. Negative tests or explicitly recorded non-test verification.
6. Findings recorded in the task ticket.

### CI integration

Run `agentic-init scan . --format json` in CI. Start in warning-only mode; promote high/critical findings to a merge-blocking exit code after fixtures prove false-positive rate is acceptable.

### Acceptance criteria

- Known unsafe fixture files are caught.
- Safe fixture files do not create noisy findings.
- No scan output exposes full secrets.
- CI has a documented severity threshold.

## 11. Workstream G — Memory, Handoffs, and Learning

### Goal

Persist useful context without turning every session transcript into permanent, ungoverned instructions.

### G1. Portable memory format

Use plain Markdown plus YAML frontmatter. Store project-local runtime memory under `.agentic/memory/`, ignored by default.

```md
---
format: agentic-memory-v1
status: proposed | accepted | superseded
scope: project | ticket
created: 2026-09-09
sourceTicket: T-042-example
tags: [database, timezone]
trust: unreviewed
---

# Decision: Store booking instants in UTC

## Evidence
- Link to ticket decision and schema migration.

## Reuse guidance
- Convert only at client boundaries; do not use server-local time.

## Verification needed
- Confirm against the current schema and application code before relying on it.
```

Memory is **not** auto-loaded as executable policy. A skill can search and propose relevant records, but the agent must verify important claims against tickets/code/documentation.

### G2. Handoff command

```bash
agentic-init handoff create --ticket T-042
agentic-init handoff list
agentic-init handoff show <id>
```

Initial scope: create drafts from a ticket's concise state and let a human edit/approve them. Do not attempt automatic transcript ingestion.

### G3. Lesson candidates

Use the existing `LESSONS.md` as the governed source of truth. Add a separate queue:

```text
ai-workspace/lesson-candidates/
  LC-001-ticket-state-drift.md
```

Workflow:

1. A completed ticket or reviewer can propose a candidate lesson.
2. Candidate records the repeated evidence, scope, proposed rule/skill change, and token cost.
3. Human invokes `/lesson-review`.
4. Approved candidates become a `LESSONS.md` entry first, then a rule/skill change.
5. Rejected/superseded candidates are deleted or marked accordingly.

This preserves the current principle: a rule must have recorded operational evidence.

### Acceptance criteria

- Memories are local, portable, inspectable, and ignored by default.
- Unreviewed memory never overrides canonical project rules.
- No lesson becomes a rule without explicit human approval and evidence.
- Ticket handoffs remain concise and link back to source evidence.

## 12. Workstream H — Skill and Rule Catalog

### Goal

Add only small, high-leverage workflows that use the existing ticket and evidence model.

### H1. Core skills to add

| Skill | Trigger | Required output |
|---|---|---|
| `plan` | New non-trivial work | Ticket with discovery, file ownership, tiering, risks, verification |
| `research` | Upstream API, library, standard, current behavior needed | Sources, findings, impact on plan, uncertainty |
| `review` | Non-trivial implementation complete | Structured independent review report |
| `security-review` | Sensitive/security-relevant scope | Threat checklist and prioritized findings |
| `build-fix` | Confirmed type/build/lint failure | Minimal diagnosis/fix, command evidence |
| `update-docs` | Public API/process behavior changes | Documentation inventory and changed artifacts |
| `lesson-review` | Candidate lesson exists | Accept/reject/promote decision |

Existing `testing`, `refactor`, `ui-responsiveness`, type-specific skills, and implementation agents stay. The new skills should reference the canonical core workflow rather than reproduce it.

### H2. Language packs

Start with one actively supported pack: JavaScript/TypeScript.

```text
.agentic/packs/typescript/
  rules.md
  testing.md
  review.md
  security.md
```

Rules in a pack must be evidence-backed, short, and testable where possible. New languages are only added when the project has a maintainer and fixture examples—not because ECC has them.

### Acceptance criteria

- Every skill has a clear trigger, input, non-goals, and output contract.
- Skills load on demand; no large catalog is automatically inserted into global instructions.
- Packs are selectable installer components and have tests.

## 13. Workstream I — Optional Local Plan Review Surface

### Goal

Make ticket/plan approval easier for a non-terminal reviewer without requiring a hosted service.

### Scope

Provide a local-only command after all P0/P1 work is stable:

```bash
agentic-init plan-view ai-workspace/tickets/T-042-example.md
```

It may serve a local HTML page that renders ticket sections, Mermaid diagrams, inline comments, and an explicit `approved` / `changes-requested` decision. The decision updates the existing ticket approval field; it does not create a parallel plan artifact.

### Safety and constraints

- Bind only to `127.0.0.1` by default.
- Do not send tickets to an external service.
- Require the ticket path to remain under the project target.
- The Markdown ticket remains canonical; the viewer is only a UI.

### Acceptance criteria

- The page works offline and has no remote analytics.
- A decision is represented in the same ticket file, not a side database.
- It is optional and not included in minimal/core profiles.

## 14. Workstream J — Documentation, Community, and Repository Hygiene

### Files to add

| File | Purpose |
|---|---|
| `CHANGELOG.md` | Human-readable released changes and migration notes |
| `CONTRIBUTING.md` | Local setup, test commands, contribution expectations, docs/rule evidence standard |
| `SECURITY.md` | Private reporting route, supported versions, response expectations, scanner limitations |
| `LICENSE` | Confirm the intended license text is present and declared consistently |
| `.editorconfig` | Basic cross-editor text consistency |
| `.npmignore` or package `files` test | Ensure only intended package assets ship |

### Documentation changes

- README: profiles, harness support matrix, lifecycle commands, safety promise, quick start.
- SETUP: provider-specific installation and tool prerequisites.
- CLAUDE/AGENTS: adapter-specific behavior, not duplicated core policy.
- LESSONS: only human-approved production evidence.
- New troubleshooting section: missing Graphify, malformed MCP JSON, modified generated files, repair/update/uninstall behavior.

### Acceptance criteria

- Every command in README appears in CLI help and has at least one test.
- Every shipped optional component has a documented capability and limitation.
- Security reporting instructions do not expose public vulnerability details prematurely.

## 15. Implementation Order and Milestones

### Milestone 1 — Foundation (P0)

1. Fix known documentation inconsistency: `bin/cli.js` says sections “0–12,” while the manual ends at §11.
2. Add dev tooling, test runner structure, lint/format/document checks.
3. Add CI on Windows and Linux.
4. Add installation state, `status`, and `doctor`.
5. Write canonical workflow core and derive root `AGENTS.md` plus the Claude adapter.

**Exit criteria:** The package is CI-tested, a user can diagnose an install, and Claude/Codex can consume a single governed workflow.

### Milestone 2 — Safe Lifecycle and Primary Adapters (P0)

1. Implement `update`, `repair`, `uninstall`, and `adopt`.
2. Add Codex and GitHub Copilot adapters.
3. Test fixture installation from `npm pack` output.
4. Add changelog, contributing, security policy, and release checklist.

**Exit criteria:** A project can safely install, upgrade, and remove selected Claude/Codex/Copilot components without losing local modifications.

### Milestone 3 — Quality and Security (P1)

1. Add independent reviewer and build-fixer roles/skills.
2. Add security-review skill.
3. Implement local agent/config scanner and CI warning mode.
4. Implement strict profile hooks with explicit consent.
5. Add Cursor adapter only after its capability matrix and hook behavior are verified.

**Exit criteria:** A strict-profile project can produce independent review evidence and detect common unsafe agent configuration patterns without forced global tooling.

### Milestone 4 — Durable Improvement (P2)

1. Add memory/handoff format and commands.
2. Add lesson-candidate/review workflow.
3. Add research and documentation-update skills.
4. Add TypeScript pack and fixture project.
5. Promote scanner high/critical findings to blocking CI after tuning.

**Exit criteria:** Lessons are reviewable and reusable, and the template has one maintained stack pack with evidence-based rules.

### Milestone 5 — Optional UX (P3)

1. Add offline plan viewer.
2. Evaluate additional language packs based on demand and maintainer capacity.
3. Publish package releases from CI only after manual release checklist is proven.

## 16. Ticket Breakdown

Do not implement this as one large change. Suggested tickets:

| Ticket | Scope | Dependencies |
|---|---|---|
| T-001 | Correct CLI/manual section references; establish package scripts | none |
| T-002 | Add Node test framework, lint/format/docs validation | T-001 |
| T-003 | Add Windows/Linux CI and packed-artifact smoke test | T-002 |
| T-004 | Add state-aware install and `status` | T-001, T-002 |
| T-005 | Add read-only `doctor` with JSON output | T-004 |
| T-006 | Add safe `update` and conflict proposal artifacts | T-004, T-005 |
| T-007 | Add `repair`, `uninstall`, and legacy `adopt` | T-006 |
| T-008 | Extract canonical workflow core and create `AGENTS.md` | T-001 |
| T-009 | Add Codex and Copilot adapters plus rendering tests | T-008, T-004 |
| T-010 | Add contributor/security/changelog/release documentation | T-003 |
| T-011 | Add read-only reviewer role and review skill | T-008 |
| T-012 | Add security-review skill and configuration scanner | T-002, T-008 |
| T-013 | Add strict-profile hooks and explicit consent/configuration | T-004, T-012 |
| T-014 | Add memory/handoff and lesson-candidate workflow | T-008 |
| T-015 | Add TypeScript pack and fixtures | T-002, T-008 |
| T-016 | Add offline plan viewer | T-004, T-008 |

Every ticket must use the existing ticket template, claim files before dispatch, and remain independently mergeable.

## 17. Test and Security Gates for Every Milestone

Before closing any enhancement ticket:

1. Run existing conformance checks.
2. Run scoped unit/integration tests for the changed module.
3. Test a clean installation in a temporary fixture directory.
4. Test a target with a custom `CLAUDE.md`, custom `.mcp.json`, and custom `.gitignore`.
5. Test `--dry-run` leaves an identical directory hash.
6. Test a malicious or malformed state/config fixture where the change touches lifecycle code.
7. Have the independent reviewer inspect behavior, not just code style, for P0/P1 changes.
8. Record unrun verification honestly in the ticket.

## 18. Explicit Decisions: What Not To Copy from ECC

| ECC-style feature | Decision for this template |
|---|---|
| Hundreds of skills/agents | Do not copy. Maintain a small catalog with clear triggers and tests. |
| Always-running continuous-learning daemon | Do not copy. Use human-approved, ticket-backed lesson candidates. |
| Mandatory TDD/coverage percentage for all work | Do not copy as a blanket rule. Preserve explicit testing authorization and task-appropriate evidence. |
| Multiple default MCP servers | Do not copy. Keep Graphify as the sole optional default; require explicit choices for others. |
| Global harness installation | Do not copy in v1. Keep installation project-local and reversible. |
| Hosted dashboard/service | Do not copy. If a plan viewer is built, keep it local-only and optional. |
| Automatic external actions | Do not copy. No automatic pushes, PRs, database changes, deployments, or remote writes. |

## 19. Overall Definition of Done

The template enhancement program is complete when:

1. The core workflow is one governed source rendered into supported harness adapters.
2. A project can install, inspect, update, repair, adopt, and uninstall template components safely.
3. CI validates the packed package on Windows and Linux.
4. Strict profile features are opt-in, transparent, and safe by default.
5. Independent review and security scan workflows produce evidence-backed results.
6. Learning/memory remains inspectable and human-governed.
7. The maintained skill/rule catalog stays deliberately small and on-demand.
8. README, setup, security, contributing, changelog, and release process match real behavior.
9. The project has no undocumented assumption that a particular agent harness supports an unavailable feature.

## 20. Immediate Next Step

Begin with **T-001: Correct references and establish package-quality checks**. It is small, touches no generated project state, and creates the verification base required before lifecycle or adapter changes.

Then implement T-004/T-005 (state-aware install and doctor) before any hooks, memory, or broad integration. Safe installation and automated verification are the foundation for every other enhancement.
