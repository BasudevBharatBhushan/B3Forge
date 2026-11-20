# Behavior Book

The behavior book is the project's current contract in plain words: what the system does,
as observable rules. Tickets change it; it never drifts, because a ticket cannot reach
`COMPLETED` until its B7 section is merged here.

- `/discovery` reads the file for each affected area before planning. Code that disagrees
  with it is a finding to report, not an assumption to resolve silently.
- Each ticket declares its changes in section B7; the developer approves them with the plan.
- `/close-ticket` merges B7 into the area file.

## Format

One file per area: `ai-workspace/behavior/<area>.md`, e.g. `auth.md`, `billing.md`.

- First line: `# Area: <Name>`
- One block per rule: `## Rule: <name>`, then `- WHEN ...` and `- THEN ...` lines.
  More `- WHEN`, `- THEN`, `- AND` lines are allowed.
- Last line of each block: `<!-- last changed: T-NNN -->` (the ticket that last touched it).
- Rule names are unique within a file; they are how B7 finds the block to replace or delete.
- Describe observable behavior, not implementation. No file paths or function names.

## Example

```markdown
# Area: Auth

## Rule: Login lockout
- WHEN a user fails login 5 times in a row
- THEN the account is locked for 15 minutes
- AND the user sees a "try again later" message
<!-- last changed: T-012 -->
```

## How B7 is merged

| B7 block | Effect on the area file |
|----------|-------------------------|
| `ADDED Rule: X` | Append the rule block |
| `CHANGED Rule: X` | Replace the whole block named X with the new text |
| `REMOVED Rule: X` | Delete the block named X |

Update the `last changed` tag to the closing ticket. A missing area file is created with
its `# Area:` heading. `None — no behavior change` merges nothing.
