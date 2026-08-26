---
trigger: manual
description: Full mandatory-rules reference. The condensed, binding version is CLAUDE.md — load this only when auditing or extending the rules.
---

# Agent Rules — Full Reference

> **`CLAUDE.md` is authoritative.** This file expands on it. It introduces no rule that
> `CLAUDE.md` lacks. If they disagree, `CLAUDE.md` wins.

---

## Context loading

Load on demand, by scope. Never preload. See `CLAUDE.md` §11 for the table.

Before deep file exploration, query the knowledge graph (`.agents/rules/graphify.md`)
rather than scanning directories. If a required doc is missing, **stop and request
clarification** — do not proceed on assumption.

---

## Ticket discipline

All development work belongs to a ticket. **The ticket is the only artifact a task
produces** — problem, discovery, plan, subtasks, agent assignments, test cases, decisions,
one file.

Never create: separate plan or implementation-plan files, execution logs, "Execution Log" /
"Status Update" sections, separate test-scenario files, or summary docs. *(API docs, SQL
scripts, and module `agents.md` files are deliverables, not process artifacts — those are
still written.)*

**Status:** `TODO` → `IN_PROGRESS` → `AWAITING_TEST` → `COMPLETED` | `BLOCKED`

- New tickets start at `TODO`; dispatching moves to `IN_PROGRESS`
- Implementation verified but tests not run → `AWAITING_TEST`
- Cannot proceed → `BLOCKED`, with the reason in Decisions & Blockers
- Graph discovery completes before the plan section is written
- Plan-mode output is copied **verbatim** into the Plan section before execution
- Tickets stay under ~150 lines, updated **in place**, never appended to
- `active-ticket` is a ≤5-line pointer, **overwritten** on status change — not a journal

Never implement without an approved ticket.

---

## Implementation restrictions

- Only modify files listed in the ticket's plan section
- Do not modify unrelated modules
- Do not introduce new frameworks or technologies unless explicitly instructed
- Do not perform large refactors unless explicitly planned
- Do not expand scope during execution without approval
- Do not silently change architecture patterns
- **Never modify existing UI design** without explicit developer approval

If the plan turns out to be wrong, stop and revise the ticket. Do not improvise past it.

---

## Execution discipline — subagentic by default

Implementation is always delegated; the developer never has to request it. The orchestrator
never writes code.

| `subagent_type` | Model | Scope |
|-----------------|-------|-------|
| `impl-small` | Haiku | Mechanical single-site edits |
| `impl-mid` | Sonnet | Judgment, cross-file contracts, correctness reasoning, new modules |
| Orchestrator | the main loop | Planning, dispatching, diff reading, verification. No edits. |

- The tier is bound by `model:` in `.claude/agents/<name>.md` — **not** by the prompt. Every
  implementation dispatch names `impl-small` or `impl-mid` as its `subagent_type` and passes
  **no** `model` override. Dispatching to `general-purpose` inherits the orchestrator's model
  and is the standing failure mode
- Default to `impl-small`; promote a row only when stating the subtask requires explaining *why*
- Agent tier is recorded per subtask **at plan time**, so approval covers the split
- **Partition by FILE, not by subtask.** Parallel agents must never share a file
- Foundation subtasks complete before consumer edits fan out
- A brief carries only: the subtask, exact `file:line` targets, the ticket's non-goals, the
  acceptance condition, and "touch nothing else." Never the full ticket, plan, or graph dump
- Subagents return `FILES: / CHANGES: (≤10 lines) / SELF-CHECK:` — no prose
- The orchestrator reads the real diff before any subtask is marked `[x]`
- One subtask dispatched and verified per response

### Sanity gate — automatic, every subtask, not "testing"

| Check | Command |
|-------|---------|
| Types | `TYPECHECK_CMD` in the affected package |
| Lint | `LINT_CMD`, scoped to touched files |
| Logic | Orchestrator reads the diff against the acceptance condition |

---

## Testing discipline

**Tests are not run unless the developer explicitly asks.** Cases are authored at plan time
in the ticket's Verification table, left `NOT RUN`, ticket at `AWAITING_TEST`. Test cases
live in the ticket only — never a separate file.

- Every case states its tool and the exact condition checked
- Prove behavior at the lowest layer that can: pure function → logic unit → service → API →
  browser (last resort)
- Browser/E2E testing requires explicit approval and a reason it cannot be done functionally
- **Confirm the harness exists before planning against it.** `NONE` means wiring it is its
  own approved task
- Loop `run → diagnose → fix (subagent) → re-run` until green, **hard cap 3 fix cycles**;
  on the 4th failure stop, record the diagnosis, hand back
- Record outcomes as `PASS` / `FAIL` / `NOT RUN`. Report honestly — an accurate `NOT RUN`
  beats implied coverage

**Closure:** `COMPLETED` requires the sanity gate green, every diff verified, and either the
requested tests passing or the developer approving closure without them.

---

## Architecture discipline

Where the project declares a layer order (commonly `Route → Controller → Service → Model`):

- **Transport layer** (routes) — define endpoints, attach middleware and handlers
- **Handler layer** (controllers) — HTTP request/response, input validation, delegate to
  services. No business logic
- **Service layer** — business logic; framework-free and independently callable
- **Data layer** (models) — queries and persistence only. No business logic

Cross-layer shortcuts are architecture changes and require approval.

For fullstack work: both sides listed in the plan, request/response contract kept
consistent, and no backend change that breaks an existing frontend flow without approval.

---

## Database safety

Never perform CRUD against a real database — no creating, no reading production data, no
updating, no deleting. See `.agents/rules/database.md`.

---

## API documentation

Every created, updated, or modified endpoint gets a doc in `ai-workspace/docs/api/`
covering request body, params, query, headers, response shape, validation notes, and flow
notes where relevant. Backend API changes are never left undocumented.

---

## Error handling and clarification

Stop and request clarification when:

- required files are missing
- ticket scope is unclear
- instructions conflict with architecture rules
- the change would affect unrelated modules
- implementation requires assumptions not explicitly approved
- the frontend/backend contract is ambiguous
- environment variables are missing
- the change appears to require hidden infrastructure assumptions

**Never guess requirements.**

---

## Environment and configuration

- Never hardcode credentials, keys, IDs, secrets, URLs, or test inputs — read from
  environment/config
- Applies universally, **including** scratch scripts, diagnostics, and one-off validation
  scripts
- If a required variable is missing, stop and request the developer add it
- The agent is not authorized to modify environment files directly

---

## General principles

- Prefer minimal, safe changes; avoid unnecessary refactoring
- Maintain backward compatibility unless explicitly instructed
- Keep changes small and traceable
- Never perform repo-wide changes without explicit approval
- Clarify ambiguity before implementing
- Temporary, scratch, or diagnostic scripts go in `temp/` or `tmp/`, never the repo root
- **One authority for the rules.** Nested rule docs are *views* that name the authoritative
  file. Copies drift, then contradict, then get followed
- Mark superseded docs with an explicit banner naming what replaced them
