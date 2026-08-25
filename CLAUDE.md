# Agent Operating Manual

Loaded every session. Binding. **Design goal: minimum tokens, full context** — one artifact
per task, cheap models writing, an expensive model only judging. Expansions live in `.agents/`
(§11), loaded on demand only. `LESSONS.md` holds the production failure behind each rule.

---

## 0. Project Configuration — FILL THIS IN FIRST

The rules below refer to these by name. Until filled in, **ask rather than guess.** Never
infer a command from convention — run it once, record what it actually does. `NONE` is a valid
value and a planning constraint, not something to invent around.

| Key | Value |
|-----|-------|
| `TYPECHECK_CMD` | `<e.g. npx tsc --noEmit / mypy . / go vet ./... / cargo check>` |
| `LINT_CMD` | `<e.g. npm run lint / ruff check / golangci-lint run>` |
| `UNIT_TEST_CMD` | `<the unit test runner — verify it is actually a test runner>` |
| `API_TEST_CMD` | `<the API/integration test runner, or NONE if not wired>` |
| `BUILD_CMD` | `<the build command, if distinct from typecheck>` |
| Repo topology | `<single-repo / monorepo / split-repo — see §9>` |
| Packages | `<the top-level packages or apps, e.g. web, api, worker>` |
| Scope types | `<the valid scope classifications for this project — see §3>` |

---

## 1. The Workflow

```
prompt → scope (§3) → graph discovery (§4)
  → ticket: plan + subtasks + agent tier per subtask + test cases, all in one file (§2)
  → DEVELOPER APPROVAL — the plan and the delegation split, together
  → subagent execution, one subtask at a time, partitioned by file (§5)
  → sanity gate on every subtask: typecheck · lint · diff read (§6)
  → orchestrator verification → graph refresh → AWAITING_TEST
  → [ testing ONLY on explicit request: loop to green, max 3 cycles (§7) ] → COMPLETED
```

No implementation without an approved ticket. No exceptions.

---

## 2. The Ticket Is The Only Artifact

`ai-workspace/tickets/T-NNN-slug.md` from `.agents/templates/TICKET_TEMPLATE.md` — problem,
discovery, plan, subtasks, agent-per-subtask, test cases, decisions. **One file per task,
nothing else.** Never create separate plan files, execution logs, "Execution Log" / "Status
Update" sections, separate test-case files, or summary and hand-off docs. *(API docs, SQL
scripts, and module `agents.md` are deliverables, not process artifacts — still written.)*
Plan-mode output is transient: paste it into the Plan section **verbatim** before work.

**Two parts, two audiences.** *Part A — Summary* for a technical lead or manager: what is
wrong, what changes, how in short, impact & risk — plain language, **no file paths, function
names, line numbers, or jargon**, ≤25 lines. *Part B — Technical Detail* for the implementing
agent: root cause with `file:line`, non-goals, discovery, plan, subtasks, verification. Write
B first, then compress into A. Each point stated once — A in plain language, B carries the
evidence and does not restate it.

**Hygiene — this is the token budget.** Resume header (first ~7 lines) must be enough to
resume: status, scope, current subtask, files; on resume read it first and the body only when
you need the plan. Whole ticket **≤170 lines**. Update **in place** — never append. Discovery
holds only findings that affect the plan; never paste raw graph or search output.

**Status:** `TODO` → `IN_PROGRESS` → `AWAITING_TEST` → `COMPLETED` | `BLOCKED`.
`AWAITING_TEST` = implementation verified, tests not run (§7) — that distinction is the point.

**`ai-workspace/active-ticket` is a pointer, not a journal** — ≤5 lines (ID, path, status,
current subtask, one blocker), **overwritten** on every status change. An append-only one
becomes a second source of truth that grows forever and is re-read on every resume.

---

## 3. Scope Classification

Classify before any work; scope decides which docs load. Defaults (adjust in §0): **frontend**
— UI, client logic, rendering · **backend** — API, middleware, services, data access, business
rules · **fullstack** — both, including the API contract the UI depends on. Do not claim
`fullstack` unless the task genuinely spans both: wider scope, wider blast radius.

---

## 4. Discovery Before Editing — Graph First

The project keeps a **Graphify knowledge graph** of the codebase. Query it instead of scanning
directories. Setup and advanced use: `.agents/rules/graphify.md`. No graph yet → building it
is a setup task, not a licence to skip discovery.

| Need | Call |
|------|------|
| Which files relate to a feature | `query_graph` with a keyword |
| A specific function/component/module | `get_node` by label |
| What calls this / what it calls | `get_neighbors` |
| All code in a subsystem | `get_community` |
| Most critical shared abstractions | `god_nodes` |
| How two concepts connect | `shortest_path` |
| Orientation — counts | `graph_stats` |

Query the graph **before any exploration**, and use the returned paths to target reads.
`get_neighbors` on anything you are about to edit, for callers and dependents — this is what
prevents unintended breakage. `shortest_path` entry point → leaves for cross-cutting changes.
No exemption for "quick" lookups. Discovery completes **before** the plan is written; refresh
the graph **once per ticket** after implementation is verified, not per subtask.

---

## 5. Execution Is Always Subagentic

Implementation is delegated by default; the developer never has to ask for it.

| Tier | Role |
|------|------|
| **Small model** (e.g. Haiku) | Mechanical single-site edits — swap a formatter, change one render line, align a fallback, rename a field |
| **Mid model** (e.g. Sonnet) | Design judgment, cross-file contracts, correctness and date/time reasoning, new modules, anything with an invariant to preserve |
| **Orchestrator** (e.g. Opus, the main loop) | **Never writes code.** Plans the split, dispatches, reads every diff, verifies against acceptance criteria |

- **Tier is assigned per subtask in the ticket at plan time**, so the developer approves the
  delegation split along with the plan — not after the fact.
- **Partition by FILE.** One agent owns one file, or a file set no other agent touches;
  several subtasks in one file all go to that file's agent. Parallel agents sharing a file
  clobber each other silently — hard constraint, not a preference.
- **Foundation first.** Shared helpers or modules others import run to completion before
  consumer edits fan out in parallel.
- **The brief is minimal:** subtask text · exact paths and line numbers · the ticket's
  non-goals · its acceptance condition · "touch nothing else". **Never paste the whole ticket,
  the whole plan, or a graph dump into a subagent prompt** — the single largest source of
  waste in subagentic development.
- **The return is fixed and compact**, no prose, no restating the plan:
  ```
  FILES: <paths touched>
  CHANGES: <≤10 lines, what changed and where>
  SELF-CHECK: <typecheck/lint result, or the specific condition verified>
  ```
- **Read the actual diff** before marking a subtask `[x]`. A subagent's claim that it did
  something is not evidence that it did.

Constraints: one subtask dispatched and verified per response · only files listed in the
ticket's plan · no new frameworks, unplanned refactors, or silent architecture changes ·
**never modify existing UI design without explicit developer approval** · if the plan is
wrong, stop and revise the ticket rather than expanding scope mid-execution.

---

## 6. Sanity Gate — Automatic, Every Subtask

Cheap static checks during implementation. **Not** "testing"; never skipped or deferred.
`TYPECHECK_CMD` in the affected package · `LINT_CMD` **scoped to the touched files** (never
lint the whole repo to check one file) · orchestrator reads the diff against the subtask's
acceptance condition. No `[x]` until all three are clean.

---

## 7. Testing — On Explicit Request Only

**Never run tests unless the developer explicitly asks** — `/testing` is that request. Author
the cases at plan time, leave them `NOT RUN`, set `AWAITING_TEST`. §6 guards correctness
meanwhile. **Prove behavior at the lowest layer that can prove it:**
`pure function → state/logic unit → service → API → browser (last resort)`

| Tool class | Use for | Command |
|------------|---------|---------|
| Unit | Pure functions, logic units, component/state behavior | `UNIT_TEST_CMD` |
| API / Integration | Endpoint behavior, cross-layer flows | `API_TEST_CMD` |
| Dry run | Static or aesthetic changes only — typecheck + diff read | — |
| Browser / E2E | **Avoid.** Only if genuinely unreachable functionally, with explicit developer approval | — |

**Confirm the harness exists first:** if `API_TEST_CMD` is `NONE`, say so in the ticket and
treat wiring it as its own approved task. Never write cases against a runner that is not there.

**The loop:** run → fail → diagnose → fix via subagent → re-run. **Hard cap 3 fix cycles.** On
the 4th failure stop, record the failing case and your diagnosis, hand it back — by then the
problem is usually the specification. Record every outcome as `PASS` / `FAIL` / `NOT RUN`.

**`COMPLETED` requires:** sanity gate green · every diff verified by the orchestrator · the
requested tests passing, or the developer approving closure without them.

---

## 8. Module `agents.md`

Every module carries one at its root so an agent orients in one read instead of exploring.
Template `.agents/templates/AGENTS_MD_TEMPLATE.md`, **max 100 lines**: purpose · key exports
with `file:line` · dependencies · layer breakdown · common tasks · where tests live ·
non-obvious gotchas. Missing → create it on first work there. Significant change → update it.
Major modification → read it first.

---

## 9. Repository Topology

Declare it in §0. The rules say "the affected package" rather than naming directories, so they
hold for a single repo, a monorepo (scope and gate per package), and split repos under one
parent — where each subdirectory is its own git repo: `cd` into the specific repo before any
git command · commit and push within that repo only · **never** commit across repos from the
parent · the shared `ai-workspace/` lives at the parent, with no nested copies.

**One authority.** A subdirectory's own rules or workflow doc is a *view* of this file and must
say so. Anything describing a superseded process carries a superseded banner. Duplicated rule
docs drift, then contradict, then get followed.

---

## 10. Standing Rules

**Communication.** Answer like a developer briefing a technical manager: outcome first, short
bullets over paragraphs, only what is needed to understand the decision, issue, or next step.
Technical detail is welcome — explained, not jargon-laden. No repetition, no generic filler, no
text dumps. Offer further detail; supply it when asked. Governs conversation only — files the
agent writes follow their templates, and §5's return format wins where they overlap.

**Database.** Never CRUD a real database. Schema change → write SQL to
`ai-workspace/sql/NNN_description.sql`, ask the developer to review and run it, then update
`ai-workspace/docs/db-architecture.md`. Detail: `.agents/rules/database.md`.

**API contracts.** Document every new or changed endpoint in
`ai-workspace/docs/api/NNN_description.md` — body, params, query, headers, response shape,
validation notes. A backend API change is never left undocumented. Keep the declared layer
order (commonly `Route → Controller → Service → Model`): HTTP validates and delegates, the
service layer holds business logic and stays framework-free, the data layer holds queries only.

**Time.** Dates involved → adopt `.agents/rules/timezone.md`: the client supplies the timezone
against a documented default, the server's own local time is never an input, store UTC and
convert at the edges. This bug class is silent and corrupts stored data.

**Environment.** Never hardcode credentials, keys, IDs, secrets, URLs, or test inputs — read
from environment/config, **including** in scratch and diagnostic scripts. Missing variable →
stop and ask. The agent is not authorized to edit environment files.

**General.** Minimal safe changes, no cleanup beyond task scope · keep backward compatibility
unless told otherwise · no repo-wide changes without explicit approval · clarify ambiguity,
never guess requirements · scratch scripts in `temp/`, never the repo root.

---

## 11. Load On Demand

Never preload. Fetch by scope, when the task actually needs it. Missing doc → stop and ask.

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

**Skills** — auto-discovered from `.claude/skills/<name>/SKILL.md`, each carrying out this
workflow for one kind of task: `/testing` (the §7 trigger) · `/refactor` (behavior-preserving
restructuring) · `/ui-responsiveness` (viewport behavior audit and fix). A skill that
contradicts this file is wrong, not authoritative.
