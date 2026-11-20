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

Anything unresolved stays `AWAITING_TEST` or goes `BLOCKED`, with the reason in B8 Decisions
& Blockers.

## Steps

1. Confirm the requirements above.
2. **Merge B7 into `ai-workspace/behavior/<area>.md`** (format: that folder's README):
   `ADDED` → append the rule block · `CHANGED` → replace the block with that rule name ·
   `REMOVED` → delete that block. Set each touched block's `<!-- last changed: T-NNN -->`
   to this ticket. Missing area file → create it with `# Area: <Name>`.
   `None — no behavior change` → nothing to merge.
3. Validate: run `npx github:BasudevBharatBhushan/B3Forge validate . --ticket <id> --closing`
   (checks the ticket as if `COMPLETED`: no open subtasks, B7 present in the book). Fix every
   error; continue only on exit 0 (warnings are allowed, mention them to the developer).
4. Refresh the graph (once per ticket).
5. Only now set status `COMPLETED` in the ticket's resume header.
6. **Delete the ticket's row from `ai-workspace/active-tickets`** (rewrite the file whole) —
   the ticket file is the record.
