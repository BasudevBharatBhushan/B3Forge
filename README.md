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
| **Implementation is delegated** | Small models do mechanical edits, mid models do judgment work, the orchestrator never writes code — it plans, dispatches, and reads every diff. |
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

That writes `CLAUDE.md`, `.agents/`, `.claude/skills/`, and `ai-workspace/`, adds the
graphify MCP server to `.mcp.json`, and appends `graphify-out/` to `.gitignore`. Existing
files are never overwritten — an existing `CLAUDE.md` is left alone and the template lands
beside it as `CLAUDE.agentic.md` to merge. Re-running is safe.

| Flag | |
|---|---|
| `--dry-run` | report what would happen, write nothing |
| `--force` | overwrite existing files |
| `--no-mcp` | skip the `.mcp.json` entry |
| `--no-skill` | skip installing the graphify skill |
| `--graph-path <p>` | non-default `graph.json` location |

Then fill in the **§0 Project Configuration** table at the top of `CLAUDE.md` — the
typecheck, lint, and test commands, your repo topology, and your scope types. That table is
what makes a stack-agnostic template executable.

Full checklist, including Graphify setup: **`SETUP.md`**.

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
  active-ticket                      ≤5-line pointer. Overwritten, never appended
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
4. **Tiered models** — the expensive model judges; it does not type.

The counterintuitive part is #4. Having the strongest model write the code is the obvious
default, and it is both more expensive and *worse at review* — an author verifies their own
work less critically than a fresh reader. Separating writer from reviewer improved quality
and cut cost at the same time.

---

## Contributing

If a rule fails in practice, the fix is a `LESSONS.md` entry plus the rule change — in that
order. A rule without a recorded reason gets deleted by the next person who finds it
inconvenient.
