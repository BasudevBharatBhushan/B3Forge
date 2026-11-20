# B3Forge v0.3 — Implementation Plan

**Status:** DRAFT — awaiting approval
**Date:** 2026-11-20
**Target release:** 0.3.0

## Goals

| # | Goal | Done when |
|---|------|-----------|
| 1 | **Slim `CLAUDE.md`** — keep only what must be loaded every session; move the rest into skills that load on demand | `CLAUDE.md` ≤ 7 KB (~1,800 tokens, down from 22 KB / ~5,500), enforced by a test |
| 2 | **Behavior book** (Gap 1) — a living record of what the system does, updated by every ticket | Closing a ticket merges its behavior changes into `ai-workspace/behavior/` |
| 3 | **`validate` command** (Gap 2) — check that the AI followed the ticket rules | `b3forge validate .` exits non-zero on a broken ticket and explains why |
| 4 | **Real tests + CI** (Gap 3) — protect B3Forge users from B3Forge bugs | Every push runs the test suite on macOS, Linux, and Windows |
| 5 | **TypeScript** — convert all JS (CLI, hooks, tests) to TS | No hand-written `.js` left; `npx github:…` still works with no build step for the user |

## Non-goals

- No change to the workflow's *meaning* — same rules, just loaded differently.
- No new runtime dependencies. The CLI stays zero-dependency (TypeScript is dev-only).
- No npm publish in this release (can follow later).
- No back-filling the behavior book for existing projects — it fills up ticket by ticket.

---

## Key decisions

**D1. Ship compiled JS in git (commit `dist/`).**
`npx github:BasudevBharatBhushan/B3Forge` installs straight from the repo. If we only kept TS
source, every user run would have to download TypeScript and compile first (slow, fragile).
So we commit the compiled output, and CI fails if `dist/` is out of date with `src/`.

**D2. Node ≥ 22.**
`node:test` needs ≥ 18, and Node 18 and 20 are both end-of-life as of today. Use 22 (LTS) and
test on 22 + 24.

**D3. Hooks are compiled into `.agentic/hooks/*.js`.**
Hooks are copied into user projects and run with plain `node`, so they must stay JS on disk.
Source moves to `src/hooks/*.ts`; the build writes the `.js` files where the installer
already looks. Pin the TypeScript version so the output bytes are stable — the installer
fingerprints these files, and changing bytes would make every user see an "update".

**D4. Safety rules never leave `CLAUDE.md`.**
A skill only loads if the model decides to load it. Anything that must *always* hold
(database, secrets, push approval, "orchestrator never writes code") stays in `CLAUDE.md`.
Skills hold *procedures*, not *prohibitions*.

**D5. `CLAUDE.md` names each skill's trigger explicitly.**
e.g. "Before writing or editing a ticket → `/ticket`." Don't rely on the model noticing
a skill on its own.

**D6. Keep `bin/cli.js` as a tiny shim** that loads `dist/cli.js`, so the `bin` path in
`package.json` and in users' scripts never changes.

---

## Phase 0 — Clean up and safety net

Do this first so every later phase is protected by tests.

- [ ] Delete `grep.exe.stackdump`.
- [ ] Move `INSTALLER_UPGRADE_PLAN.md`, `TEMPLATE_ENHANCEMENT_PLAN.md`, and this file into
      `docs/plans/` (root files aren't shipped, but they clutter the repo).
- [ ] Add a TypeScript toolchain for tests only: `typescript` + `@types/node` as devDependencies,
      a `tsconfig.json` (`strict: true`, `target: ES2022`, `module: node16`).
- [ ] Write **black-box tests** in `test/*.test.ts` that run `bin/cli.js` as a subprocess
      against a temporary fake project. Because they only call the CLI from outside, they
      keep working unchanged when the CLI itself is converted to TS in Phase 1:
  - `install`: creates the files, writes `install-state.json`, never overwrites an existing file.
  - `--dry-run`: writes nothing.
  - `update`: updates untouched files, **preserves edited files**, `--write-conflicts` writes
    the proposed file next to the edited one.
  - `uninstall`: removes only files it installed and still unchanged.
  - `doctor` / `repair` / `adopt` / `status`: basic happy path + one failure each.
  - `scan`: flags a known-bad config, passes a clean one.
  - Profiles: `minimal` installs no hooks; `strict` without `--enable-hooks` refuses.
  - Port every existing assertion from `test/conformance.js` (except the `CLAUDE.md`
    section checks, which Phase 2 replaces).
- [ ] Add `.github/workflows/ci.yml`: matrix {ubuntu, macos, windows} × {Node 22, 24};
      steps `npm ci` → `npm run build` → `npm test`.
- [ ] **Fix the installer so it doesn't ship CI to users.** With the Copilot adapter selected,
      `desired()` copies the whole `.github/` folder into the user's project, which would
      include our `ci.yml`. Exclude `.github/workflows/` (and add a test that checks this).
- [ ] `package.json`: `engines.node` → `>=22`; `scripts.test` → `tsc -p test && node --test`.

**Done when:** CI is green on all 6 combinations and the old `conformance.js` is deleted.

---

## Phase 1 — Convert the code to TypeScript

Behavior-preserving. The Phase 0 tests must pass unchanged.

- [ ] Split the 333-line `bin/cli.js` into modules under `src/`:

  ```
  src/
    cli.ts               entry: parse args → dispatch command
    args.ts              argument parsing + help text
    fs-safe.ts           safeRelative, within, write, digest (path-escape protection)
    state.ts             install-state read/validate/create (typed InstallState)
    plan.ts              desired(), plannedFiles(), mcpPlan(), ignorePlan()
    commands/
      install.ts         install + update
      report.ts          status + doctor
      repair.ts  uninstall.ts  adopt.ts  scan.ts  handoff.ts  plan-view.ts
    hooks/
      ticket-state.ts  secret-warning.ts  validation-reminder.ts
  ```

- [ ] Add real types: `Options`, `InstallState`, `FileRecord`, `Action` (as a discriminated
      union on `op`, replacing the stringly-typed `label()` lookup).
- [ ] Build: `tsc` → `dist/` for the CLI; a second tsconfig emits hooks into
      `.agentic/hooks/*.js`. Pin `typescript` to an exact version.
- [ ] `bin/cli.js` → 2-line shim: `#!/usr/bin/env node` + `require('../dist/cli.js')`.
- [ ] `package.json` `files`: add `dist`; keep `src`/`test` out of the shipped package.
- [ ] CI step: `npm run build && git diff --exit-code` — fails if someone edited `src/`
      but forgot to rebuild `dist/`.

**Done when:** no hand-written `.js` remains outside `dist/` and the generated hooks; all Phase 0
tests pass; `npx github:<branch>` works on a clean machine with no TypeScript installed.

---

## Phase 2 — Slim `CLAUDE.md`, move detail into skills

### 2a. What stays in `CLAUDE.md` (~100 lines)

| Keep | Why it must be always-on |
|------|--------------------------|
| One-paragraph design goal | Frames everything |
| §0 Project Configuration table | Every command depends on it |
| §1 Workflow diagram | The order of operations |
| Hard rules, as one-liners: no code without an approved ticket · orchestrator never writes code · dispatch only to `impl-small`/`impl-mid`, never with a `model` override · partition by file · read every diff · tests only on request, max 3 fix cycles, never weaken an assertion | Breaking any of these causes silent damage |
| Sanity gate + commit-per-subtask | Runs on every subtask |
| Standing safety rules: database, irreversible/outward actions, environment & secrets, communication style | Must never depend on a skill being loaded |
| **Skill trigger table** (see 2b) | Tells the model *when* to load each skill |
| Load-on-demand doc index | Same, for rule docs |
| Compact Instructions | Needed at compaction time |

### 2b. What moves out

| New / updated skill | Load when | Takes content from |
|---------------------|-----------|--------------------|
| **`/ticket`** (new) | Writing or editing any ticket | §2 — Part A/B, size limits, update-in-place, subtask states, status lifecycle, `active-tickets` rules, module two-level tickets; §8 module `agents.md` |
| **`/dispatch`** (new) | About to send work to a subagent | §5 — tiering test, `ESCALATE`, fixed brief + return formats, waves, cross-ticket file claims, foundation-first |
| **`/resume`** (new) | Starting a session with work in flight | §2 — reconcile ticket vs `git log`/`git status`, "git wins", recovering `[~]` subtasks |
| **`/discovery`** (new) | Before writing a plan | §4 — graph-first, `get_neighbors`, "the graph locates, it doesn't testify"; plus reading the behavior book (Phase 3) |
| **`/close-ticket`** (new) | Moving a ticket to `COMPLETED` | §7 completion criteria; merge behavior changes (Phase 3); run `validate` (Phase 4); delete the `active-tickets` row |
| `/testing` (update) | Developer asks for tests | §7 — lowest-layer-first ladder, harness check, the loop, module-level testing |
| `.agents/rules/topology.md` (new rule doc) | Multi-repo or parallel work | §9 — topology, parallel isolation modes |
| `.agents/rules/backend.md` (update) | Backend scope | §10 API-contract detail |

Each new skill stays ≤ 150 lines. Skill descriptions are always loaded (one line each), so keep
descriptions short and specific.

### 2c. Keep other harnesses working

Codex, Cursor, and Copilot don't load `.claude/skills/`. `.agentic/core/operating-manual.md`
and `.agents/workflows/workflow.md` remain their source. Point those docs at the skill files
as plain on-demand references instead of copying the text, so there's one copy of each
procedure.

### 2d. Existing users (migration)

Every real user has edited `CLAUDE.md` (they filled in §0), so `update` will **preserve**
their copy and they'll never get the slim one automatically.
- [ ] Ship the new `CLAUDE.md` via `update --write-conflicts` (writes `CLAUDE.md.proposed`).
- [ ] `CHANGELOG.md` migration note: "copy your §0 table into the new file."
- [ ] Stretch: `update` detects the old layout and carries the §0 table over automatically.

### 2e. Tests

- [ ] `CLAUDE.md` byte budget: fail if > 7,168 bytes.
- [ ] Every skill named in the trigger table exists at `.claude/skills/<name>/SKILL.md`.
- [ ] Every hard rule from 2a is still present (keyword assertions, like today's
      conformance checks).
- [ ] Every doc path referenced in `CLAUDE.md` exists.

**Done when:** budget test passes and a manual dry run of one full ticket (plan → dispatch →
close) in a sample project shows each skill being loaded at the right moment.

---

## Phase 3 — Behavior book (Gap 1)

- [ ] New folder `ai-workspace/behavior/` with a `README.md` that explains the format.
      Shipped automatically, since `ai-workspace` is already an installed root.
- [ ] One file per area of the app, e.g. `ai-workspace/behavior/auth.md`:

  ```markdown
  # Area: Auth

  ## Rule: Login lockout
  - WHEN a user fails login 5 times in a row
  - THEN the account is locked for 15 minutes
  <!-- last changed: T-012 -->
  ```

- [ ] Add section **B7. Behavior changes** to `TICKET_TEMPLATE.md` (and the child-ticket
      parts of `MODULE_TICKET_TEMPLATE.md`, `EXAMPLE_TICKET.md`):

  ```markdown
  ## B7. Behavior changes
  **Area:** auth
  ### ADDED Rule: Login lockout
  - WHEN … - THEN …
  ### CHANGED Rule: Session timeout
  - WHEN … - THEN …   (full new text; old text is replaced)
  ### REMOVED Rule: Remember-me cookie
  ```
  or `None — no behavior change` (allowed only for `refactor` and `chore`).

- [ ] Wire into the workflow:
  - `/discovery`: read the behavior file for the affected area before planning.
  - Plan approval: the developer approves B7 along with the plan ("what will change", in
    plain words).
  - `/close-ticket`: apply B7 to the behavior file (add / replace / delete rules, update
    the `last changed` tag).
- [ ] Keep the ticket's ≤ 170-line budget: B7 counts toward it.

**Done when:** the sample project from Phase 2 closes a ticket and its rule appears in the
behavior book.

---

## Phase 4 — `validate` command (Gap 2)

`src/commands/validate.ts`. Usage:

```
npx github:BasudevBharatBhushan/B3Forge validate .               # all tickets + behavior book
npx github:BasudevBharatBhushan/B3Forge validate . --ticket T-007
```

**Checks:**

| Area | Check | Severity |
|------|-------|----------|
| Header | All fields present; `Status` and `Type` are valid values | error |
| Size | Ticket ≤ 170 lines; Part A ≤ 25 lines | error |
| Subtasks | Every row's Agent is `impl-small` or `impl-mid` | error |
| Completion | `COMPLETED` ticket has no `[ ]` or `[~]` rows | error |
| Completion | `COMPLETED` ticket is not in `active-tickets` | error |
| Completion | Its B7 rules actually appear in the behavior book | error |
| B7 | Section exists; `None` only on `refactor` / `chore` | error |
| Registry | Every `active-tickets` row points to an existing ticket with a matching status | error |
| Registry | Two in-flight tickets claim the same file | warning |
| Behavior book | Every rule has a WHEN and a THEN; no duplicate rule names in an area | error |

**Output:** one line per problem, `T-007:42  COMPLETED ticket has unfinished subtask 3`.
Exit `0` clean, `1` errors found, `2` bad usage.

- [ ] Parsing lives in `src/ticket/parse.ts` (shared with `plan-view`, which already reads tickets).
- [ ] Test fixtures: `test/fixtures/tickets/good/` and one broken ticket per check in `bad/`.
- [ ] `/close-ticket` runs `validate --ticket <id>` before marking `COMPLETED`.
- [ ] Strict profile: the `ticket-state` hook calls `validate` instead of its current regex.

**Done when:** every row in the table has a passing "good" and a failing "bad" fixture.

---

## Phase 5 — Release

- [ ] `README.md`: update the token-budget pitch with the measured numbers, document `validate`
      and the behavior book, update the "What's in here" tree.
- [ ] `SETUP.md`: Node ≥ 22; the migration note from 2d.
- [ ] `CHANGELOG.md`: 0.3.0 entry.
- [ ] `package.json`: version `0.3.0`; consider renaming `name` to `b3forge`.
- [ ] Tag `v0.3.0` and push (needs your approval at the time).

---

## Order and dependencies

```
Phase 0 (tests + CI) ──► Phase 1 (TypeScript) ──► Phase 4 (validate, written in TS)
        │                                              ▲
        └──► Phase 2 (slim CLAUDE.md) ──► Phase 3 (behavior book) ──┘
                                                    └──► Phase 5 (release)
```

Phases 1 and 2 are independent and can be done in either order. Each phase is its own branch
and its own set of reviewable commits.

## Risks

| Risk | Mitigation |
|------|------------|
| The model doesn't load a skill when it should | D4 (no safety rules in skills) + D5 (explicit trigger table) + the Phase 2 dry run |
| Existing users never get the slim `CLAUDE.md` | 2d migration path |
| Recompiled hooks change bytes → spurious "update" for every user | Pinned TS version; build is deterministic; a test compares hook output to a checked-in hash |
| `dist/` drifts from `src/` | CI `git diff --exit-code` after build |
| Behavior book is skipped "just this once" | `validate` fails a `COMPLETED` ticket whose B7 isn't in the book |
| Node ≥ 22 locks out some users | Node 18 and 20 are already end-of-life; note it clearly in the changelog |

## Open questions

1. Rename the package from `agentic-development-template` to `b3forge`? (Recommended — it
   also gives a nicer `npx b3forge` command if you publish to npm later.)
2. Publish to npm in 0.3.0, or keep `npx github:` only for now?
