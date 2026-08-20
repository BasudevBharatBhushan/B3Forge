---
description: Full workflow reference. The condensed, binding version is CLAUDE.md — load this only when auditing or extending the workflow itself.
---

# Agent Development Workflow — Full Reference

> **`CLAUDE.md` is authoritative.** This file adds rationale, sequencing detail, and worked
> examples. It does not introduce rules that `CLAUDE.md` lacks. If they disagree, `CLAUDE.md`
> wins and this file is the bug.

Design goal: **minimum token consumption with full context.**

---

## The pipeline

```
Prompt
  ↓ 1. Scope Classification
  ↓ 2. Graph Discovery
  ↓ 3. Ticket authoring — plan, subtasks, agent-per-subtask, test cases embedded
  ↓ 4. Developer Approval  ◀── plan AND delegation split, together
  ↓ 5. Subagent Execution — one subtask at a time, partitioned by file
  ↓ 6. Sanity Gate — typecheck, lint, diff read (every subtask, automatic)
  ↓ 7. Orchestrator Verification
  ↓ 8. Graph Update (once per ticket)
  ↓ 9. AWAITING_TEST
  ↓ 10. [ Testing — only on explicit request. Loop to green, max 3 cycles ]
  ↓ 11. COMPLETED
```

---

## Step 1 — Scope classification

Classify before loading anything. Scope decides which docs load and which rules apply, so
getting it wrong costs context immediately.

Resist widening. `fullstack` means the task genuinely spans the UI *and* the contract it
depends on — not that you are unsure.

---

## Step 2 — Graph discovery

Mandatory, and it happens **before** the plan is written. Setup and tool reference:
`.agents/rules/graphify.md`.

Discovery must identify: impacted files, related modules, dependencies, request/response
flow, architectural constraints, and existing patterns to follow.

**Condense before recording.** The ticket gets the findings that affect the plan — not raw
tool output. Raw graph dumps in a ticket are re-read on every subsequent access and inform
nothing.

---

## Step 3 — Ticket authoring

`ai-workspace/tickets/T-NNN-slug.md` from `.agents/templates/TICKET_TEMPLATE.md`.

| Section | Purpose |
|---------|---------|
| Resume header | Cheap resume — status, scope, current subtask, target files |
| Problem / Objective / Non-goals | Non-goals are copied into every subagent brief |
| Discovery | Condensed graph findings |
| Plan | The plan-mode artifact, verbatim |
| Subtasks | Table: subtask, file(s), **agent tier**, done-checkbox |
| Verification | Test cases authored now, run later or never |
| Decisions & Blockers | Only what a future reader needs |

Nothing else is created for a task. Genuine deliverables — API docs, SQL scripts, module
`agents.md` — are not process artifacts and are still written.

**Plan mode output is transient.** Paste it into the Plan section verbatim before execution.

---

## Step 4 — Approval

The developer approves the plan **and** the delegation split in one pass, because the agent
column is already filled in. Nothing dispatches before this.

---

## Step 5 — Subagentic execution

The orchestrator does not write code. It plans, dispatches, and verifies.

### Tiering

| Tier | Give it |
|------|---------|
| Small | Mechanical single-site edits — swap a formatter, change one line, align a default, rename a field |
| Mid | Design judgment, cross-file contracts, correctness and date/time reasoning, new modules, invariants to preserve |
| Orchestrator | Planning, dispatching, diff reading, verification. No edits. |

**The tiering test:** if the subtask can be stated as "in file X at line N, change A to B,"
it is small-tier work. If stating it requires explaining *why*, it needs the mid tier.

### Partitioning — the hard constraint

**By FILE, never by subtask number.** One agent owns exactly one file, or a set no other
agent touches. Parallel agents sharing a file overwrite each other silently — no error, no
conflict marker, just work that quietly isn't there.

**Sequencing:** foundation subtasks — new shared helpers or modules other files import — run
to completion first. Then consumers fan out in parallel. Where the project declares a layer
order, respect it when sequencing.

### The brief

Exactly five things:

1. The subtask text
2. Exact file paths and line numbers
3. The ticket's non-goals
4. The acceptance condition
5. "Touch nothing else."

Never the full ticket, the full plan, or the graph dump. Context sent to N agents costs N
times; nine of ten agents cannot use the other nine subtasks.

### The return contract

```
FILES: <paths touched>
CHANGES: <≤10 lines, what changed and where>
SELF-CHECK: <typecheck/lint result, or the specific condition verified>
```

Then the orchestrator reads the real diff. **A subagent's claim is not evidence.**

---

## Step 6 — Sanity gate

Automatic, every subtask, never skipped. Not testing.

| Check | Command |
|-------|---------|
| Types | `TYPECHECK_CMD` in the affected package |
| Lint | `LINT_CMD`, scoped to touched files |
| Logic | Orchestrator reads the diff against the acceptance condition |

No subtask is `[x]` until all three pass.

---

## Step 7–8 — Verification and graph update

The orchestrator verifies each diff against the subtask's acceptance condition before the
checkbox moves. Then refresh the knowledge graph **once for the ticket**, not per subtask.

If the graph update fails, report it and request guidance rather than proceeding silently.

---

## Step 9–10 — Testing

Cases were authored at plan time and sit as `NOT RUN`. Nothing executes until the developer
asks. Invoking `.agents/workflows/test.md` *is* that request.

### Tool selection

```
pure function  →  logic unit  →  service  →  API  →  browser (last resort)
```

Confirm the harness exists before planning against it. `NONE` in the config block means
wiring it is its own approved task, not an assumption to build on.

### The loop

```
run → fail → diagnose → fix (dispatch a subagent) → re-run
```

**Hard cap: 3 fix cycles.** On the 4th failure, stop and hand back with the diagnosis — by
then the problem is usually the specification, not the code.

Results go in the Verification table: `PASS` / `FAIL` / `NOT RUN`. Report honestly; a
recorded `NOT RUN` is worth more than implied coverage.

---

## Step 11 — Closure

`COMPLETED` requires the sanity gate green, every diff verified, and either the requested
tests passing or the developer approving closure without them.

---

## Anti-patterns

| Don't | Because |
|-------|---------|
| Create a plan/log/test file beside the ticket | Sprawl compounds; agents find and follow stale files |
| Append to the active-ticket pointer | It becomes a second source of truth that can't be truncated |
| Paste the ticket into subagent prompts | Multiplies context N times for no benefit |
| Partition parallel work by subtask | Agents sharing a file silently destroy each other's edits |
| Plan browser tests by default | They get written in detail and never run |
| Assume a `test` command runs tests | It frequently runs something else entirely |
| Copy these rules into a subdirectory | Copies drift, then contradict, then get followed |
| Loop on a failing test indefinitely | After ~3 tries the spec is wrong, not the code |
| Let the author verify their own work | A fresh reader reviews more critically |
