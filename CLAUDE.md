# Agent Operating Manual

This file is loaded into every session. It is the **complete** specification of how agentic
development works in this project. Everything below is binding.

Deeper reference docs live in `.agents/` — load them only when auditing or extending the
rules themselves, never as routine context.

**Design goal: minimum token consumption with full context.** One artifact per task, cheap
models writing, an expensive model only judging. Every rule here traces back to that.

---

## 0. Project Configuration — FILL THIS IN FIRST

This template is stack-agnostic. The rules below refer to these commands by name; a new
project makes them concrete here, once. Until this table is filled in, the agent must ask
rather than guess.

| Key | Value |
|-----|-------|
| `TYPECHECK_CMD` | `<e.g. npx tsc --noEmit / mypy . / go vet ./... / cargo check>` |
| `LINT_CMD` | `<e.g. npm run lint / ruff check / golangci-lint run>` |
| `UNIT_TEST_CMD` | `<the unit test runner — verify it is actually a test runner>` |
| `API_TEST_CMD` | `<the API/integration test runner, or NONE if not wired>` |
| `BUILD_CMD` | `<the build command, if distinct from typecheck>` |
| Repo topology | `<single-repo / monorepo / split-repo — see §9>` |
| Packages | `<list the top-level packages or apps, e.g. web, api, worker>` |
| Scope types | `<the valid scope classifications for this project — see §3>` |

> **Never assume a command from convention.** A `test` script frequently runs something
> that is not a test suite. Run it once, confirm what it does, and record the truth here.
> Record `NONE` where a harness genuinely does not exist — an absent harness is a planning
> constraint, not something to invent around.

---

## 1. The Workflow

```
Prompt
  ↓ Scope Classification
  ↓ Graph Discovery
  ↓ Ticket — plan, subtasks, agent-per-subtask, test cases ALL embedded
  ↓ Developer Approval  ◀── the plan AND the delegation split approved together
  ↓ Subagent Execution — one subtask at a time, partitioned by file
  ↓ Sanity Gate — typecheck, lint, diff read (automatic, every subtask)
  ↓ Verification by the orchestrator
  ↓ Graph Update
  ↓ AWAITING_TEST
  ↓ [ Testing — ONLY if the developer explicitly asks. Loop until green, max 3 cycles ]
  ↓ COMPLETED
```

No implementation without an approved ticket. No exceptions.

---

## 2. The Ticket Is The Only Artifact

`ai-workspace/tickets/T-NNN-slug.md`, created from `.agents/templates/TICKET_TEMPLATE.md`.

**One file per task. Nothing else.** It carries the problem, the discovery, the plan, the
subtasks, the agent assignment per subtask, the test cases, and the decisions.

Do **NOT** create:

- separate plan or implementation-plan files
- execution logs, or "Execution Log" / "Status Update" sections inside the ticket
- separate test-scenario or test-case files
- summary, writeup, or hand-off docs

*(Genuine deliverables are not process artifacts and are still written: API docs, SQL
migration scripts, module `agents.md` files.)*

**Plan mode:** when plan mode produces a plan, paste that content into the ticket's `Plan`
section **verbatim** before starting work. The plan artifact is transient; the ticket is
the durable record.

### Ticket hygiene — this is the token budget

- The **resume header** (first ~7 lines) must be enough to pick the work back up: status,
  scope, current subtask, target files. When resuming, read the header first; read the body
  only when you actually need the plan.
- Keep the whole ticket under **~150 lines**. Update **in place**. Never append.
- Condense discovery to the findings that affect the plan. Never paste raw graph or search
  output into the ticket — it is dead weight on every later read.

### Status

`TODO` → `IN_PROGRESS` → `AWAITING_TEST` → `COMPLETED` | `BLOCKED`

`AWAITING_TEST` exists because testing is deferred by default (§7). It means implementation
is verified but tests have not run — the distinction between that and `COMPLETED` is the
whole point.

### The active-ticket pointer

`ai-workspace/active-ticket` is a **pointer, not a journal** — at most 5 lines: ticket ID,
path, status, current subtask, one blocker line. **Overwrite** it on every status change.

An append-only active-ticket becomes a second source of truth that duplicates ticket
content, grows without bound, and gets re-read on every resume. Do not let it.

---

## 3. Scope Classification

Classify before any work. The scope determines which docs load and which rules apply.

Default scopes (adjust in §0 for this project):

- **frontend** — UI, UX, client-side logic, rendering, user interactions
- **backend** — API, middleware, service logic, data access, business rules
- **fullstack** — both sides: UI *and* the API contract it depends on

Do not assume `fullstack` unless the task genuinely spans both. A wider scope means a wider
blast radius and more context loaded.

---

## 4. Discovery Before Editing

This project maintains a **Graphify knowledge graph** — a queryable map of the codebase
(nodes for files/functions/components, edges for calls and imports, clustered into
communities). Use it instead of broad directory scans.

Setup and full tool reference: `.agents/rules/graphify.md`. If the graph does not exist
yet, build it before the first ticket — an unbuilt graph is a setup task, not a licence to
skip discovery.

| Situation | Call |
|-----------|------|
| Which files relate to a feature | `query_graph` with a keyword |
| A specific function/component/module | `get_node` by label |
| What calls this / what it calls | `get_neighbors` |
| All code in a subsystem | `get_community` |
| Most critical shared abstractions | `god_nodes` |
| How two concepts connect | `shortest_path` |
| Orientation — counts | `graph_stats` |

**Protocol:**

1. **Before any exploration** — query the graph first. Use the returned paths and node IDs
   to target reads precisely instead of scanning directories.
2. **Before writing or editing** — `get_neighbors` on what you are about to touch, to learn
   its callers and dependents. This is what prevents unintended breakage.
3. **For cross-cutting changes** — `shortest_path` from entry point to affected leaves, to
   map the full call chain before touching anything.
4. **Do not skip it for "quick" lookups** — a graph query surfaces non-obvious relationships
   that text search misses.

Graph discovery must be complete **before** the plan section is written. After
implementation is verified, refresh the graph **once per ticket** — not once per subtask.

---

## 5. Execution Is Always Subagentic

Implementation is delegated. This is the default; the developer never has to ask for it.

| Tier | Role |
|------|------|
| **Small model** (e.g. Haiku) | Mechanical single-site edits — swap a formatter, change one render line, align a fallback value, rename a field |
| **Mid model** (e.g. Sonnet) | Design judgment, cross-file contracts, correctness and date/time reasoning, new modules, anything with an invariant to preserve |
| **Orchestrator** (e.g. Opus, the main loop) | **Never writes code.** Plans the split, dispatches, reads every diff, verifies against acceptance criteria |

### Rules

- **Agent tier is assigned per subtask in the ticket at plan time** — so the developer
  approves the delegation split along with the plan, not after the fact.

- **Partition by FILE, not by subtask.** One agent owns exactly one file, or a set of files
  no other agent touches. Where several subtasks land in the same file, one agent takes all
  of them. *Parallel agents sharing a file will clobber each other's edits* — this is the
  hard constraint, not a preference.

- **Order matters.** Foundation subtasks — new shared helpers or modules that other files
  will import — run to completion **first**. Then consumer edits fan out in parallel.

- **The brief is minimal.** Each subagent gets only:
  1. its subtask text
  2. exact file paths and line numbers
  3. the ticket's non-goals
  4. its acceptance condition
  5. "touch nothing else"

  **Never paste the whole ticket, the whole plan, or the graph dump into a subagent prompt.**
  That is the single largest source of waste in subagentic development — it multiplies the
  same context across every agent you spawn.

- **The return is fixed and compact.** No prose, no restating the plan:

  ```
  FILES: <paths touched>
  CHANGES: <≤10 lines, what changed and where>
  SELF-CHECK: <typecheck/lint result, or the specific condition verified>
  ```

- **The orchestrator reads the actual diff** before marking any subtask `[x]`. A subagent's
  claim that it did something is not evidence that it did.

### Execution constraints

- One subtask dispatched and verified per response
- Only modify files listed in the ticket's plan section
- No new frameworks, no unplanned refactors, no silent architecture changes
- **Never modify existing UI design** without explicit developer approval
- Do not expand scope mid-execution; if the plan is wrong, stop and revise the ticket

---

## 6. Sanity Gate — Automatic, Every Subtask

Cheap static checks that run **during** implementation. These are **not** "testing" and are
never skipped or deferred.

| Check | Command |
|-------|---------|
| Types | `TYPECHECK_CMD` in the affected package |
| Lint | `LINT_CMD`, **scoped to the touched files** — never lint the whole repo to check one file |
| Logic | The orchestrator reads the diff against the subtask's acceptance condition |

A subtask is not `[x]` until types are clean, lint is clean on the touched files, and the
diff has been read.

---

## 7. Testing — On Explicit Request Only

**Do not run tests unless the developer explicitly asks.** Write the cases at plan time
into the ticket's Verification table, leave them `NOT RUN`, and set the ticket to
`AWAITING_TEST`. The sanity gate (§6) is what guards correctness in the meantime.

### Prefer functional tests. Prove behavior at the lowest layer that can prove it

```
pure function  →  unit of state/logic  →  service  →  API  →  browser (last resort)
```

| Tool class | Use for | Command |
|------------|---------|---------|
| Unit | Pure functions, logic units, component/state behavior | `UNIT_TEST_CMD` |
| API / Integration | Endpoint behavior, cross-layer flows | `API_TEST_CMD` |
| Dry Run | Static or aesthetic changes only — typecheck + diff read | — |
| Browser / E2E | **Avoid.** Only when a flow is genuinely unreachable functionally, and only with explicit developer approval | — |

Browser-level testing is slow, flaky, and expensive to diagnose. Any behavior expressible
as a function-level assertion must be tested that way instead.

**Before planning tests, confirm the harness exists.** If `API_TEST_CMD` is `NONE`, say so
in the ticket and treat wiring it as its own approved task. Do not write test cases against
a runner that is not there.

### The test loop

```
run → fail → diagnose → fix (dispatch a subagent) → re-run
```

Repeat until green. **Hard cap: 3 fix cycles.** On the 4th failure, stop — record the
failing case and your diagnosis in the ticket and hand it back to the developer. An
unbounded fix loop burns tokens without converging, and by the fourth attempt the problem
is usually the specification, not the code.

Record every outcome in the ticket's Verification table: `PASS` / `FAIL` / `NOT RUN`.

### Closure

`COMPLETED` requires: sanity gate green, every diff verified by the orchestrator, and
either the requested tests passing or the developer approving closure without them.

---

## 8. Module `agents.md` Files

Every module should carry an `agents.md` at its root — an AI-oriented quick reference so an
agent can orient in one read instead of exploring. Template:
`.agents/templates/AGENTS_MD_TEMPLATE.md`.

**Maintain proactively:**

- First work on a module without one → create it immediately
- After significant changes (new services, refactored components, new routes) → update it
- Before major modifications → read the existing one for current state

**Contents:** module purpose (one line) · key exports with `file:line` · dependencies ·
architecture/layer breakdown · common tasks ("to add an endpoint…") · where tests live ·
non-obvious constraints and gotchas.

**Format:** markdown, plain language, **max 100 lines** — scannable in one viewport.

---

## 9. Repository Topology

Fill in §0. The rules above say "the affected package" rather than naming directories, so
they hold for any of these:

- **Single repo** — one package, one remote. Nothing special.
- **Monorepo, one git repo** — several packages, one history. Scope changes to a package;
  run the sanity gate in that package.
- **Split repos under one parent** — each subdirectory is a standalone git repo with its own
  `.git`, history, and remote. This shape needs care:
  - `cd` into the specific repo before any git command
  - Commit within that repo only
  - Push to that repo's own remote
  - **Never** try to commit across both from the parent directory
  - The shared `ai-workspace/` lives at the parent; nested copies must not be created

**One authority for the rules.** If a subdirectory carries its own rules or workflow docs,
they are *views* of this file and must say so, naming this file as authoritative. Duplicated
rule docs drift, then contradict, then agents follow the stale copy. Any doc describing a
superseded process must carry an explicit superseded banner rather than being left to be
found and believed.

---

## 10. Standing Rules

### Database safety

Never perform CRUD against a real database. For schema changes:

1. Write SQL to `ai-workspace/sql/NNN_description.sql`
2. Request the developer review and execute it manually
3. Update `ai-workspace/docs/db-architecture.md`

Full detail: `.agents/rules/database.md`.

### API contracts

- Document every new or changed endpoint in `ai-workspace/docs/api/NNN_description.md`
  (request body, params, query, headers, response shape, validation notes)
- Keep the layer order the project declares (commonly `Route → Controller → Service →
  Model`): the HTTP layer validates and delegates, the service layer holds business logic
  and stays framework-free, the data layer holds queries and no business logic
- Backend API changes must never be left undocumented

### Time and timezones

If the project handles dates at all, adopt `.agents/rules/timezone.md` — an explicit
client-supplied-timezone policy with a documented default. The server's own local time is
never an input. Store UTC; convert at the edges. This category of bug is silent, reaches
production, and corrupts stored data.

### Environment and configuration

- Never hardcode credentials, keys, IDs, secrets, URLs, or test inputs — read from
  environment/config
- Applies universally, **including** scratch and one-off diagnostic scripts
- If a required variable is missing, stop and request the developer add it
- The agent is not authorized to modify environment files directly

### General constraints

- Prefer minimal, safe changes — no cleanup beyond the task scope
- Maintain backward compatibility unless explicitly instructed
- Never perform repo-wide changes without explicit approval
- Clarify ambiguity before implementing — never guess requirements
- Temporary or scratch scripts go in `temp/` or `tmp/`, never the repo root

---

## 11. Load On Demand

Do **not** preload these. Fetch by scope, when the task actually needs them.

| Doc | Load when |
|-----|-----------|
| `.agents/rules/coding-guidelines.md` | any implementation work |
| `.agents/rules/frontend.md` | frontend scope |
| `.agents/rules/backend.md` | backend scope |
| `.agents/rules/database.md` | DB changes involved |
| `.agents/rules/timezone.md` | date/time logic involved |
| `.agents/rules/graphify.md` | graph setup or advanced queries |
| `.agents/rules/karpathy.md` | behavioral checklist before a large or ambiguous change |
| `.agents/rules/rules.md` | auditing or extending the rules |
| `.agents/workflows/workflow.md` | auditing or extending the workflow |
| `ai-workspace/docs/db-architecture.md` | schema work |
| `ai-workspace/active-ticket` | resuming in-progress work |

If a required doc is missing, stop and request clarification.

### Skills

Task-shaped runbooks in `.claude/skills/`, invoked by name. They do not replace anything
above — each one carries out this workflow for a particular kind of task, and names the rule
doc that governs it.

| Skill | Invoke for |
|-------|-----------|
| `/testing` | The explicit request to run tests — the trigger §7 refers to |
| `/refactor` | Behavior-preserving restructuring: extract, split, rename, de-duplicate |
| `/ui-responsiveness` | Auditing and fixing UI behavior across viewport sizes |

Skills are auto-discovered from `.claude/skills/<name>/SKILL.md`. Adding one needs no
registration anywhere — but a skill that contradicts this file is wrong, not authoritative.

---

## 12. Why These Rules Exist

Each rule here was paid for. `LESSONS.md` records what went wrong in production to produce
it. Read it before deciding a rule is bureaucratic overhead — the short version:

- Multi-file-per-task workflows produced **191 obsolete markdown files** in one project
  before anyone noticed
- An append-only status file became a second source of truth that grew forever
- Whole tickets pasted into every subagent prompt multiplied context for no benefit
- Parallel agents on one file silently overwrote each other's work
- Browser test suites got specified in detail and then never ran, once
- Test plans were written against a harness that did not exist
- Duplicated rule docs in subdirectories drifted until agents followed the stale copy
