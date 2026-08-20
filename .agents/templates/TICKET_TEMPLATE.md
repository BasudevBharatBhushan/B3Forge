# T-NNN: [Title]

**Status:** TODO
**Scope:** [scope type]
**Date:** YYYY-MM-DD
**Current subtask:** —
**Files:** `path/a`, `path/b`

<!-- RESUME HEADER ENDS HERE. Everything needed to pick this ticket back up is above.
     Read the body below only when you need the plan itself. -->

---

## 1. Problem

[Observed vs. expected. Error messages. Affected surface. Specific and short.]

## 2. Objective

- [Verifiable outcome]

## 3. Non-goals

- [Explicitly out of scope — this list is copied into every subagent brief]

---

## 4. Discovery

- **Impacted components:**
- **Related files:**
- **Upstream / downstream dependencies:**
- **Architectural constraints:**

> Condensed findings only. Never paste raw graph or search output here — it is re-read on
> every later access and informs nothing.

## 5. Plan

> Paste the plan-mode output here **verbatim**. This section replaces any separate plan file.

[The approach, referencing the specific files and functions found during discovery.]

## 6. Subtasks

> **Partition by file** — one agent owns one file. Where several subtasks hit the same file,
> give them all to that file's single agent; parallel agents sharing a file overwrite each
> other silently. Foundation rows (new shared modules others import) run to completion
> before consumer rows fan out.

| # | Subtask | File(s) | Agent | Done |
|---|---------|---------|-------|------|
| 1 | [One change, one concern] | `path/a` | small | [ ] |
| 2 | [One change, one concern] | `path/b` | mid | [ ] |

**Tiers:** `small` = mechanical single-site edit · `mid` = judgment, contracts, correctness
reasoning · the orchestrator never implements, only dispatches and verifies.

*Tiering test: if the subtask can be stated as "in file X at line N, change A to B," it is
`small`. If stating it requires explaining why, it is `mid`.*

## 7. Verification

> Authored at plan time. **Not run unless the developer explicitly asks.**
> Lowest layer that can prove the behavior. Browser/E2E needs explicit approval.
> Confirm the harness exists before writing cases against it.

| # | Tool | Case | Expected | Result |
|---|------|------|----------|--------|
| 1 | [tool] | [exact condition checked] | [exact expectation] | NOT RUN |

**Sanity gate** (runs during implementation, no approval needed):

- [ ] `TYPECHECK_CMD` clean in affected package(s)
- [ ] `LINT_CMD` clean on touched files
- [ ] Every diff read by the orchestrator against its subtask's acceptance condition

## 8. Decisions & Blockers

[Only what a future reader needs: a decision made, a constraint discovered, a blocker hit.
No execution log. No narration of work already reflected in the checkboxes above.]
