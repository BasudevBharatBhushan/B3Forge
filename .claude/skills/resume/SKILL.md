---
name: resume
description: Resume work when a session starts with a ticket in flight. Reconcile active-tickets, the ticket's resume header and git log/status; git wins; recover a [~] subtask in the same or a new session.
---

# /resume

Reconcile before acting. Do not dispatch anything until the three sources agree.

1. `ai-workspace/active-tickets` — which tickets are in flight.
2. The ticket's resume header — status, scope, `Current subtask:`, files.
3. `git log --oneline` and `git status` in the affected repo.

The ticket records intent; git records what landed, and where they disagree **git wins**.
Correct the ticket (in place) to match git before continuing.

## Recovering a `[~]` subtask

A `[~]` row means an agent was mid-flight.

- **Same session** (including one reopened with `--resume`): message the agent by the ID in
  the `Current subtask:` line and it continues with full context.
- **Genuinely new session:** re-derive the brief from the file's current state — never
  re-send line numbers a half-applied edit has already moved. Read the actual diff of the
  touched files first, then dispatch per `/dispatch`.

A dirty tree on arrival that the ticket cannot explain means stopping to ask.
