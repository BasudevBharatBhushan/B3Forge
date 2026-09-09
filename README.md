# Agentic Development Template

A drop-in workflow for AI-assisted software development, tuned for **minimum token
consumption with full context**.

Stack-agnostic. Battle-tested — every rule here came from a production codebase where the
looser version of it failed. `LESSONS.md` records exactly how.

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
npx github:KiBiz-Systems/agentic-development-template
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
| `--graph-path <p>` | non-default `graph.json` location |

Then fill in the **§0 Project Configuration** table at the top of `CLAUDE.md` — the
typecheck, lint, and test commands, your repo topology, and your scope types. That table is
what makes a stack-agnostic template executable.

Full checklist, including Graphify setup: **`SETUP.md`**.

### Maintain an installed template

```bash
# Preview an upgrade. Nothing is written.
agentic-init update . --dry-run

# Apply only safe updates: untouched template files update; custom files are preserved.
agentic-init update .

# Preserve custom files and write proposed replacements beside them for review.
agentic-init update . --write-conflicts

agentic-init doctor .
agentic-init repair . --dry-run
agentic-init uninstall . --dry-run
```

These lifecycle commands require the local installation state. For a project created with an
older version, preview `agentic-init adopt . --dry-run`; adoption records only exact template
matches and leaves all other files project-owned.

### Optional capabilities

- Root `AGENTS.md` and `.agentic/core/` provide cross-harness workflow guidance.
- Claude receives native agents and skills; Codex, Cursor, and Copilot receive explicit,
  capability-limited project adapters.
- `--profile strict --enable-hooks` adds advisory hook assets; it never enables global hooks or
  external services automatically.
- `agentic-init scan .` checks agent configuration for a small set of unsafe patterns.
- `agentic-init handoff create --ticket T-001` creates an unreviewed local handoff.

---

## What's in here

```
CLAUDE.md                            The complete spec. Loaded every session. Start here.
LESSONS.md                           What went wrong in production to produce each rule.
SETUP.md                             Adoption checklist for a new project.
bin/cli.js                           The npx scaffolder. Copies this tree into a project.

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
  workflows/
    workflow.md                      Full workflow reference with rationale
    test.md                          The explicit test trigger
  templates/
    TICKET_TEMPLATE.md               The one file a task produces
    AGENTS_MD_TEMPLATE.md            Per-module AI quick-reference

.claude/
  skills/                            Task runbooks, invoked by name. Auto-discovered
    testing/                         /testing — the explicit test trigger
    refactor/                        /refactor — behavior-preserving restructuring
    ui-responsiveness/               /ui-responsiveness — viewport audit and fixes

ai-workspace/
  active-tickets                     One row per in-flight ticket. Rewritten, never appended
  tickets/                           T-NNN-slug.md — one per task
  sql/                               Migrations for developer review. Never auto-executed
  docs/
    project-structure.md             Scaffold — fill in
    db-architecture.md               Scaffold — fill in
    api/                             One doc per endpoint
```

`CLAUDE.md` is self-sufficient: an agent with only that file has the whole workflow. The
`.agents/` docs add depth and rationale, loaded on demand.

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
