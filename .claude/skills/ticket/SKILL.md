---
name: ticket
description: Write or edit a ticket in ai-workspace/tickets/. Part A/B structure, size limit, update-in-place, resume header, subtask states, status lifecycle, active-tickets index, module two-level tickets and module agents.md. Load before touching any ticket file.
---

# /ticket

Procedure for authoring and maintaining the ticket. Prohibitions (no implementation without
an approved ticket, write `[~]` before dispatch) stay in `CLAUDE.md`.

## The ticket is the only artifact

`ai-workspace/tickets/T-NNN-slug.md` from `.agents/templates/TICKET_TEMPLATE.md` —
problem, discovery, plan, subtasks, agent-per-subtask, test cases, decisions. **One file per
task, nothing else.** No separate plan files, execution logs, status-update sections,
test-case files, or hand-off docs. *(API docs, SQL scripts, module `agents.md` are
deliverables, still written.)* Plan-mode output is transient: paste it into the Plan section
**verbatim**.

## Two parts, two audiences

- *Part A — Summary* (lead/manager): what's wrong, what changes, impact & risk, plain
  language, no paths/names/line numbers/jargon, ≤25 lines.
- *Part B — Technical Detail* (implementing agent): root cause with `file:line`, non-goals,
  discovery, plan, subtasks, verification. Write B first, compress into A.

## Hygiene — the token budget

- Resume header (~7 lines): status, scope, subtask, files — read first, body only when needed.
- Ticket **≤170 lines**.
- Update **in place**, never append (a module parent's Deviation Log is the sole exception —
  a decision log, not a status journal).
- Discovery holds only plan-relevant findings.
- **Context turns over; the ticket carries the state.** The window compacts automatically —
  never wind a subtask down early, skip verification, or thin a plan to save tokens. Keep the
  resume header true as each subtask closes, so a fresh window resumes from the ticket
  instead of reconstructing it.

## Three subtask states, not two

`[ ]` not started · `[~]` dispatched, not yet verified · `[x]` gate green, diff read,
committed. Write `[~]` and the resume header's `Current subtask:` line —
`3 — dispatched (agent a7f3c2), unverified` — **before** dispatching, not after. Without it a
dead session cannot distinguish never-started from half-done, and the agent ID that would
have recovered the work is gone.

## Status lifecycle

`TODO` → `IN_PROGRESS` → `AWAITING_TEST` → `COMPLETED` | `BLOCKED`. `AWAITING_TEST` means
implementation verified, tests not yet run. Closing: `/close-ticket`.

## `ai-workspace/active-tickets` — an index, not a journal

One row per in-flight ticket: ID, path, status, current subtask, claimed files (a module
child adds its parent as `T-NNN (child M/N)`). **Rewritten whole** on every status change,
never appended, and a row holds nothing that is not already in that ticket's resume header.
**`COMPLETED` deletes the row** — the ticket file is the record. The file is bounded by what
is in flight, never by how long the project has run: if it keeps growing, that is
concurrency to question, not a file to trim.

## `module-addition` is two-level

A parent ticket (`.agents/templates/MODULE_TICKET_TEMPLATE.md`) decomposes the module into
components; each is its own child ticket (`T-NNN.1-slug.md`, `TICKET_TEMPLATE.md`) running
the normal workflow unmodified, citing the parent's Architecture Decisions instead of
re-deriving them. The parent's Component Manifest approval covers every child unless that
child's Deviation Check fails, which reopens approval for that child alone. See
`/module-addition`.

## Module `agents.md`

Every module carries one at its root so an agent orients in one read instead of exploring.
Template `.agents/templates/AGENTS_MD_TEMPLATE.md`, **max 100 lines**: purpose · key exports
with `file:line` · dependencies · layer breakdown · common tasks · where tests live ·
non-obvious gotchas. Missing → create on first work there. Significant change → update it.
