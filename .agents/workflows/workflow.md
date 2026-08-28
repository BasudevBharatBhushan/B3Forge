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
  ↓ 1. Scope + Type Classification   (Type ∈ module-addition | feature-addition | enhancement
                                       | bug-fix | refactor | migration | chore | security-fix)
  ↓ 2. Graph Discovery
  ↓ 3. Ticket authoring
       module-addition  ──▶  Parent ticket (MODULE_TICKET_TEMPLATE) decomposes into
                              child tickets T-NNN.1, T-NNN.2, … (normal TICKET_TEMPLATE)
       other Types      ──▶  single ticket (normal TICKET_TEMPLATE)
  ↓ 4. Developer Approval
       module-addition  ──▶  approve the parent's Component Manifest once; covers every
                              child's plan and delegation split in the same pass
       other Types      ──▶  approve this ticket; nothing dispatches before it
  ↓ 5. Subagent Execution — one subtask at a time, partitioned by file (per ticket; for a
       module, per child, unless a Deviation Check re-opens that child's approval)
  ↓ 6. Sanity Gate — typecheck, lint, diff read (every subtask, automatic)
  ↓ 7. Orchestrator Verification
  ↓ 8. Graph Update (once per ticket)
  ↓ 9. AWAITING_TEST  (per ticket; for a module, per child)
  ↓ 10. [ Testing — only on explicit request. Loop to green, max 3 cycles ]
       module-addition  ──▶  parent's Module-Level Acceptance runs only once every child is
                              AWAITING_TEST or COMPLETED
  ↓ 11. COMPLETED
```

---

## Step 1 — Scope and Type classification

Classify before loading anything, on two dimensions. **Scope** (unchanged) decides which docs
load and which rules apply. **Type** — one of `module-addition`, `feature-addition`,
`enhancement`, `bug-fix`, `refactor`, `migration`, `chore`, `security-fix` — decides discovery
depth, ticket rigor, default tier, and which skill runs. Getting either wrong costs context
immediately.

Resist widening the Scope. `fullstack` means the task genuinely spans the UI *and* the
contract it depends on — not that you are unsure.

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

Which template depends on Type.

**Every Type except `module-addition`:** one ticket, `ai-workspace/tickets/T-NNN-slug.md`
from `.agents/templates/TICKET_TEMPLATE.md`.

**`module-addition` is two-level:**
- **Parent** — `ai-workspace/tickets/T-NNN-slug.md` from
  `.agents/templates/MODULE_TICKET_TEMPLATE.md`. It reads the source PRD **once**, at
  decomposition, and distills it into: Architecture Decisions, Cross-Component Contracts, a
  Component Manifest table (one row per component — file scope, tier bias, dependencies),
  Sequencing, Module-Level Acceptance, and a Deviation Log. Nothing downstream re-opens the
  source PRD; the parent ticket is the distillation.
- **Children** — `ai-workspace/tickets/T-NNN.1-slug.md`, `T-NNN.2-slug.md`, … one per
  component, each from the normal `TICKET_TEMPLATE.md` and running the full pipeline
  (Steps 3–11) unmodified. A child does not restate the parent's architecture — it links back.

Both templates carry the same header fields plus two new ones: **`Type:`** (set on every
ticket) and, on children only, **`Parent:`** (the parent ticket ID) and **`Depends on:`**
(sibling child IDs it must sequence after, per the parent's Sequencing section).

The section table below describes the **component (child) ticket** — the normal template is
unchanged by this contract. The parent's own sections are the ones listed above, not this
table.

The ticket has two parts. **Part A** is the plain-language summary a technical lead or
manager reads to approve the work — no file paths, no function names, no jargon, 25 lines
max. **Part B** is the technical detail the implementing agent works from.

| Section | Purpose |
|---------|---------|
| Resume header | Cheap resume — status, scope, current subtask, target files |
| A1–A4 (Part A) | What is wrong · what changes · how, in short · impact & risk |
| B1 Root cause | The mechanism, with `file:line` evidence |
| B2 Non-goals | Copied into every subagent brief |
| B3 Discovery | Condensed graph findings |
| B4 Plan | The plan-mode artifact, verbatim |
| B5 Subtasks | Table: subtask, file(s), **`subagent_type`** (`impl-small`/`impl-mid`), done-checkbox |
| B6 Verification | Test cases authored now, run later or never |
| B7 Decisions & Blockers | Only what a future reader needs |

**Write Part B first, then compress it into Part A.** Part A states each point once in plain
language; Part B carries the evidence and does not restate it. Objective is not its own
section — the outcome lives in A2 and is proved by a matching row in B6.

Nothing else is created for a task. Genuine deliverables — API docs, SQL scripts, module
`agents.md` — are not process artifacts and are still written.

**Plan mode output is transient.** Paste it into the Plan section verbatim before execution.

---

## Step 4 — Approval

**For every non-module Type, this is unchanged:** the developer approves the plan **and** the
delegation split in one pass, because the agent column is already filled in. Nothing
dispatches before this.

**For `module-addition`, approval happens once, at the parent.** Approving the parent's
Component Manifest approves every child's plan and delegation split in the same pass — a
child does not carry its own separate approval gate. It dispatches on the strength of the
parent approval *unless* its Deviation Check fails: files outside its Manifest row, a new
cross-component contract not in the parent, or a subtask exceeding the child's tier bias. Any
of those re-opens approval for **that child alone**, logged in the parent's Deviation Log —
siblings already in flight are not blocked by it.

---

## Step 5 — Subagentic execution

The orchestrator does not write code. It plans, dispatches, and verifies.

### Tiering

| `subagent_type` | Model | Give it |
|-----------------|-------|---------|
| `impl-small` | Haiku | Mechanical single-site edits — swap a formatter, change one line, align a default, rename a field |
| `impl-mid` | Sonnet | Design judgment, cross-file contracts, correctness and date/time reasoning, new modules, invariants to preserve |
| Orchestrator | the main loop | Planning, dispatching, diff reading, verification. No edits. |

**The tiering test:** if the subtask can be stated as "in file X at line N, change A to B,"
it is `impl-small` work. If stating it requires explaining *why*, it needs `impl-mid`.
Default to `impl-small`; promote only when the test forces it.

### Dispatch — how the tier is actually enforced

The model is bound by the `model:` frontmatter in `.claude/agents/impl-small.md` and
`.claude/agents/impl-mid.md`. Nothing else binds it — a tier named in a prompt is a label,
not a routing decision.

```
Agent({ subagent_type: "impl-small", prompt: <the five-part brief> })
```

- The `subagent_type` string comes straight from the ticket's Agent column.
- **Never** dispatch implementation to `general-purpose`, `claude`, or any other type —
  those inherit the orchestrator's model and put every subtask on the expensive tier.
- **Never** pass a `model` override. If a tier is wrong for a whole class of work, edit the
  agent file; if it is wrong for one row, fix the row in the ticket.
- Read-only work stays in the orchestrator. Dispatching discovery buys a summary you then
  have to trust, at the cost of a round trip.

**When `impl-small` returns `ESCALATE:`** — it was tiered wrong. Correct the row in the
ticket to `impl-mid`, then re-dispatch. Do not silently retry on a bigger model; the ticket
is the record of what the work actually cost.

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

### Module testing

For `module-addition`, this loop runs twice, at two scopes. A **child's** test run covers
only its own B6 Verification table — it does not attempt cross-component behavior. The
**parent's** Module-Level Acceptance (M7) is the module-level analogue of a child's B6
Verification table: it is invoked by requesting testing on the **parent ID**, and only once
every child has reached
`AWAITING_TEST` or `COMPLETED`. Children passing individually does not imply it — the parent
run is what actually proves the components work together, and it must be requested and
recorded, not assumed.

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
| Re-read the source PRD after decomposition | The parent ticket is the distillation; re-opening the source means the parent failed to capture it |
| Restate parent architecture inside a child ticket | Drifts from the parent on the next edit; the child should link back, not duplicate |
| Let a module reach `COMPLETED` with Module-Level Acceptance never run | Children passing individually never proves cross-component behavior |
