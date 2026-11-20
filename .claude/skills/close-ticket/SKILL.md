---
name: close-ticket
description: Move a ticket to COMPLETED. Completion requirements, active-tickets row deletion, graph refresh. Load before setting a ticket to COMPLETED.
---

# /close-ticket

## `COMPLETED` requires

- Sanity gate green (typecheck, scoped lint, diff read) on every subtask.
- Every diff verified by the orchestrator.
- The requested tests passing, or the developer approving closure without them.
- A module parent additionally requires M7 Module-Level Acceptance passing, or explicit
  closure approval without it. Children can reach `COMPLETED` individually before M7 runs.

Anything unresolved stays `AWAITING_TEST` or goes `BLOCKED`, with the reason in B7 Decisions
& Blockers.

## Steps

1. Confirm the requirements above.
2. <!-- PHASE 3: merge B7 into behavior book -->
3. <!-- PHASE 4: run validate --ticket -->
4. Refresh the graph (once per ticket).
5. Set status `COMPLETED` in the ticket's resume header.
6. **Delete the ticket's row from `ai-workspace/active-tickets`** (rewrite the file whole) —
   the ticket file is the record.
