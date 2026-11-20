# B3Forge

A drop-in workflow for AI-assisted software development, tuned for **minimum token
consumption with full context**.

Stack-agnostic. Battle-tested — every rule here came from a production codebase where the
looser version of it failed. `LESSONS.md` records exactly how.

Measured: the always-loaded `CLAUDE.md` is now **7,131 bytes (~1,800 tokens)** per session,
down from 22,351 bytes (~5,500 tokens) in 0.2. Procedures load on demand as skills:
`/ticket`, `/discovery`, `/dispatch`, `/resume`, `/close-ticket`, `/testing`, plus one skill
per ticket type. Safety rules stay in `CLAUDE.md`; skills only add procedure.

Requires Node 22 or newer.

---

## The short version

| | |
|---|---|
| **One artifact per task** | A single ticket carries the problem, plan, subtasks, agent assignments, test cases, and decisions. No separate plan, log, or test-scenario files. |
| **Implementation is delegated** | `impl-small` (Haiku) does mechanical edits, `impl-mid` (Sonnet) does judgment work — the tier is bound by each agent's `model:` frontmatter, not by a prompt. The orchestrator never writes code; it plans, dispatches, and reads every diff. |
| **Partition by file, not subtask** | One agent owns one file. Parallel agents sharing a file overwrite each other silently. |
| **Minimal briefs** | Each subagent gets its subtask, exact `file:line` targets, non-goals, acceptance condition, and "touch nothing else." Never the whole ticket. |
| **Graph-first discovery** | Query the knowledge graph before reading files. Targeted reads instead of directory scans. |
| **Sanity gate always, tests on request** | Typecheck + scoped lint + a read diff on every subtask. Full test runs only when explicitly asked. |
| **Functional over browser tests** | Prove behavior at the lowest layer that can. Browser tests get planned in detail and then never run. |
| **Bounded loops** | Test-fix loops cap at 3 cycles. After that, the spec is wrong, not the code. |

---

## Adopt it

From your project root:

```bash
npx github:BasudevBharatBhushan/B3Forge
```

The default `core` profile writes the shared workflow, selected harness adapters, ticket
workspace, and an optional Graphify MCP entry. Existing files are never overwritten. Every file
the installer creates is fingerprinted in `.agentic/install-state.json`, so future updates can
identify customized files and preserve them.

| Flag | |
|---|---|
| `--dry-run` | report what would happen, write nothing |
| `--profile <minimal|core|strict>` | choose components; strict hooks require `--enable-hooks` |
| `--harness <list>` | choose `claude`, `codex`, `cursor`, and/or `copilot` adapters |
| `--all-harnesses` | install every supported adapter |
| `--no-mcp` | skip the `.mcp.json` entry |
| `--gitignore` | add every installed file to `.gitignore` so B3Forge files are not tracked by git; remembered for `update` |
| `--no-gitignore` | turn that off again (removes the per-file lines B3Forge added) |
| `--graph-path <p>` | non-default `graph.json` location |

### Keeping B3Forge files out of git (optional)

`--gitignore` adds one root-anchored line to `.gitignore` for every file the installer owns,
under a comment line saying B3Forge manages them. Files that already existed in your project
(and were preserved) are not listed, and neither are your own lines. `update` keeps the list
in sync, `--no-gitignore` removes it, and `uninstall` removes everything B3Forge added.

```bash
# New project: install and keep B3Forge files out of git
npx github:BasudevBharatBhushan/B3Forge --gitignore

# Project that already has B3Forge: turn it on (or off) during an update
npx github:BasudevBharatBhushan/B3Forge update . --gitignore
npx github:BasudevBharatBhushan/B3Forge update . --no-gitignore
```

Trade-offs, in plain words:

- Ignored files are not shared through git, so each teammate runs the installer themselves.
- Tickets you create later in `ai-workspace/tickets/` are not covered, because only installed
  files are listed.
- `.gitignore` does not untrack files git already knows about. If you install first and commit,
  the installer prints the `git rm --cached -- ...` command for you to run. It never runs it.
- If you want to keep even the `.gitignore` change private, skip the flag and paste the same
  lines into `.git/info/exclude` by hand.

Then fill in the project configuration in the installed Claude adapter when you use Claude
Code, and keep the shared rules in `AGENTS.md` / `.agentic/core/` as the cross-harness source.
Record the real typecheck, lint, test commands, topology, and scope types; this is what makes
the template executable rather than generic advice.

Full checklist, including Graphify setup: **`SETUP.md`**.

### Maintain an installed template

If you use the GitHub `npx` path above, use the same prefix for every lifecycle command. The
installation state lives in your project; `npx` only supplies the CLI for that invocation.

```bash
# Preview an upgrade. Nothing is written.
npx github:BasudevBharatBhushan/B3Forge update . --dry-run

# Apply only safe updates: untouched template files update; custom files are preserved.
npx github:BasudevBharatBhushan/B3Forge update .

# Preserve custom files and write proposed replacements beside them for review.
npx github:BasudevBharatBhushan/B3Forge update . --write-conflicts

npx github:BasudevBharatBhushan/B3Forge doctor .
npx github:BasudevBharatBhushan/B3Forge validate .
npx github:BasudevBharatBhushan/B3Forge repair . --dry-run
npx github:BasudevBharatBhushan/B3Forge uninstall . --dry-run
```

These lifecycle commands require the local installation state. For a project created with an
older version, preview `npx github:BasudevBharatBhushan/B3Forge adopt .
--dry-run`; adoption records only exact template matches and leaves all other files
project-owned.

Upgrading from 0.2? See "Migrating from 0.2" in `SETUP.md`.

If you deliberately install the package globally, `agentic-init <command>` is the equivalent
short form. The GitHub `npx` path is the recommended default because it needs no global install.

### Optional capabilities

- Root `AGENTS.md` and `.agentic/core/` provide cross-harness workflow guidance.
- Claude receives native agents and skills; Codex, Cursor, and Copilot receive explicit,
  capability-limited project adapters.
- `--profile strict --enable-hooks` adds advisory hook assets; it never enables global hooks or
  external services automatically.
- `npx github:BasudevBharatBhushan/B3Forge scan .` checks agent configuration for
  a small set of unsafe patterns.
- `npx github:BasudevBharatBhushan/B3Forge validate .` checks that the AI followed the ticket
  process (see below).
- `npx github:BasudevBharatBhushan/B3Forge handoff create --ticket T-001` creates
  an unreviewed local handoff.
- `npx github:BasudevBharatBhushan/B3Forge plan-view . --ticket T-001` serves a local-only ticket review page with
  explicit approve/request-changes controls; the ticket Markdown remains canonical.

### The Behavior Book

`ai-workspace/behavior/` holds the project's current behavior as plain rules, one file per
area, each rule written as `WHEN ... THEN ...`. It starts empty. Every ticket declares its
behavior changes in section B7, you approve them with the plan, and `/close-ticket` merges
them into the book. `/discovery` reads the relevant area before planning, so the AI starts
from what the system is supposed to do, not from a guess. Format: `ai-workspace/behavior/README.md`.

### Validate

```bash
npx github:BasudevBharatBhushan/B3Forge validate .                  # every ticket + the book
npx github:BasudevBharatBhushan/B3Forge validate . --ticket T-007   # one ticket
npx github:BasudevBharatBhushan/B3Forge validate . --ticket T-007 --closing   # as if COMPLETED
```

`validate` checks that the AI followed the ticket process. It does not test your app. It
checks ticket headers and statuses, the size limits, that every subtask names `impl-small` or
`impl-mid`, that B7 is present, that COMPLETED tickets are fully checked off, out of
`active-tickets`, and merged into the behavior book, that `active-tickets` matches the real
tickets, and that behavior rules have a WHEN and a THEN and unique names. It warns when two
in-flight tickets claim the same file. Tickets from 0.2 (no behavior section) get one warning
and skip the B7 and behavior-book checks. Each problem prints as
`<path>:<line>  <error|warning>  <message>`, followed by a summary line; `--json` prints the
same data as JSON. Exit code 0 means no errors (warnings are allowed), 1 means errors, 2 means
bad usage or an unknown ticket. `--closing` (needs `--ticket`) checks the ticket as if it were
COMPLETED, ignoring its `active-tickets` row; `/close-ticket` runs it after merging B7 and
before marking the ticket COMPLETED.

---

## What's in here

```
AGENTS.md                            Universal project entry point.
CLAUDE.md                            Slim always-loaded Claude adapter (~1,800 tokens).
CHANGELOG.md                         Released capability and migration history.
CONTRIBUTING.md                      Contribution and lifecycle-safety guide.
SECURITY.md                          Vulnerability reporting and scanner limits.
bin/cli.js                           Entry point (`b3forge`, alias `agentic-init`).
src/                                 TypeScript source for the CLI and hooks.
dist/                                Compiled output; committed, CI fails on drift.
test/                                Black-box CLI and docs-budget tests.
docs/plans/                          Implementation plans, including v0.3.

.agentic/
  core/                              Canonical workflow, review contract, memory format
  manifests/components.json          Profile/component inventory
  hooks/                             Strict-profile advisory hook assets
  packs/typescript/                  Optional TypeScript guidance
  config.example.json                Strict-profile hook configuration example

.agents/
  rules/
    rules.md                         Full mandatory-rules reference
    coding-guidelines.md             Coding standards — any implementation work
    frontend.md                      UI / client-side scope
    backend.md                       API / service / data scope
    database.md                      DB safety, migration review flow, data corrections
    timezone.md                      Client-supplied-timezone policy
    graphify.md                      Knowledge-graph setup and tool reference
    karpathy.md                      Behavioral checklist — assumptions, simplicity, surgical diffs
    topology.md                      Single-repo / monorepo / split-repo guidance
  workflows/
    workflow.md                      Full workflow reference with rationale
    test.md                          The explicit test trigger
  templates/
    TICKET_TEMPLATE.md               The one file a task produces
    AGENTS_MD_TEMPLATE.md            Per-module AI quick-reference

.claude/
  agents/                            Implementers plus reviewer, security, build, research roles
  skills/                            Claude-native runbooks, loaded on demand
    ticket/ discovery/ dispatch/     /ticket, /discovery, /dispatch
    resume/ close-ticket/            /resume, /close-ticket (runs validate)
    testing/                         /testing — the explicit test trigger
    bug-fix/ feature-addition/ enhancement/ module-addition/ ui-responsiveness/
                                     type skills, one per ticket type
    refactor/                        /refactor — behavior-preserving restructuring
    review/ security-review/         fresh-context review; security-sensitive changes
    build-fix/ research/ lesson-review/

.codex/                              Capability-limited Codex adapter
.cursor/                             Capability-limited Cursor adapter
.github/
  copilot-instructions.md            GitHub Copilot instructions
  prompts/                           plan, review, security-review, build-fix prompts

ai-workspace/
  active-tickets                     One row per in-flight ticket. Rewritten, never appended
  tickets/                           T-NNN-slug.md — one per task
  behavior/                          Behavior book: WHEN/THEN rules per area, filled ticket by ticket
  lesson-candidates/                 Human-reviewed proposed lessons
  sql/                               Migrations for developer review. Never auto-executed
  docs/
    project-structure.md             Scaffold — fill in
    db-architecture.md               Scaffold — fill in
    api/                             One doc per endpoint
```

`AGENTS.md` plus `.agentic/core/` is the shared workflow source. Harness adapters add only
their platform-specific surface. The `.agents/` docs provide deeper rationale on demand.

---

## Design rationale

Agentic development fails in a specific, repeatable way: **context sprawl**. Every task
leaves artifacts, every artifact gets re-read, every subagent receives a copy of everything,
and the cost per unit of work climbs until the workflow collapses under its own
documentation.

This template attacks that on four fronts:

1. **One artifact per task** — sprawl has nowhere to accumulate.
2. **Cheap resume** — a 7-line header answers "where was I", the common case, without
   reading the plan.
3. **Minimal briefs** — context sent to N agents costs N times, so send only what each one
   needs.
4. **Tiered models** — the expensive model judges; it does not type. Enforced by two agent
   definitions in `.claude/agents/` whose `model:` frontmatter binds the tier; the ticket's
   subtask table names the agent per row, so approving the plan approves the model spend.

The counterintuitive part is #4. Having the strongest model write the code is the obvious
default, and it is both more expensive and *worse at review* — an author verifies their own
work less critically than a fresh reader. Separating writer from reviewer improved quality
and cut cost at the same time.

---

## Contributing

If a rule fails in practice, the fix is a `LESSONS.md` entry plus the rule change — in that
order. A rule without a recorded reason gets deleted by the next person who finds it
inconvenient.
