---
name: dispatch
description: Send work to an implementation subagent. Tiering test, ESCALATE handling, the fixed 5-field brief and 3-field return, waves, cross-ticket file claims, foundation-first ordering. Load before every subagent dispatch.
---

# /dispatch

Procedure for dispatching. The hard rules (orchestrator never writes code, only
`impl-small`/`impl-mid`, no `model` override, partition by file, one wave per response, read
every diff) stay in `CLAUDE.md`.

## Tiers

- **Small** (`impl-small`) — mechanical single-site edits: swap a formatter, change one
  render line, align a fallback, rename a field.
- **Mid** (`impl-mid`) — design judgment, cross-file contracts, correctness and date/time
  reasoning, new modules, anything with an invariant to preserve.
- **Orchestrator** (the main loop) — plans the split, dispatches, reads every diff,
  verifies against acceptance criteria.

## Dispatch is by agent name, not by intention

The only thing that binds a model is the `model:` frontmatter in
`.claude/agents/impl-small.md` and `.claude/agents/impl-mid.md`. Every dispatch is `Agent`
with `subagent_type: "impl-small"` or `"impl-mid"` — the literal string from the ticket's
Agent column. Other types (`general-purpose`, `claude`, `Explore`, `Plan`) inherit the
orchestrator's model, silently escalating tier. A `model` override is invisible to review
and drifts — the agent file is the single source of truth. Editing a file yourself "because
it's quick" is a dispatch you skipped.

**Read-only work stays in the orchestrator** — discovery, graph queries, diff reading,
verification are never dispatched; a subagent that only reads costs a round trip and
returns a summary you then have to trust.

## Tiering test

Tier is assigned per subtask in the ticket at plan time — the Agent column holds the literal
`subagent_type`, so approval and dispatch read the same string. **Default to `impl-small`.**
Promote to `impl-mid` only when forced: statable as "in file X at line N, change A to B" →
`impl-small`; needs *why* explained → `impl-mid`. All-`impl-mid` plans were not tiered.

**`ESCALATE` is a valid return.** An `impl-small` agent returning `ESCALATE:` was tiered
wrong, not broken — re-dispatch to `impl-mid` and correct the tier in the ticket; never just
raise the model on the same brief without recording it.

## Partitioning and waves

- **Partition by FILE** — one agent owns one file, or a file set no other agent touches;
  several subtasks in one file all go to that file's agent. Parallel agents sharing a file
  clobber each other silently.
- **Across tickets the same rule holds.** A ticket's `Files:` header is its claim on those
  paths. Before dispatching into one ticket while another is in flight, check the claims in
  `active-tickets`: overlapping file sets mean the tickets serialize, or one gets
  re-planned. Agents in two different tickets clobber each other exactly as silently as two
  in the same one — the ticket boundary is not a lock.
- **Foundation first** — shared helpers/modules others import run to completion before
  consumer edits fan out.
- **One wave dispatched and verified per response** — a wave is one agent, or several whose
  file sets are disjoint; every diff in a wave is read and verified before the next wave is
  planned.
- Before dispatching: write `[~]` and the `Current subtask:` line (see `/ticket`).

## The brief — fixed and minimal

The same five tagged fields every time, so bloat is visible at a glance. Never paste the
whole ticket, plan, or a graph dump into it:

```
<subtask>one change, one concern</subtask>
<targets>exact paths, with line numbers where known</targets>
<non_goals>copied from the ticket's B2, verbatim</non_goals>
<acceptance>the condition a read of the diff proves or disproves</acceptance>
<constraints>touch nothing else · run TYPECHECK_CMD · return the fixed block</constraints>
```

## The return — fixed and compact

No prose, no restating the plan:

```
FILES: <paths touched>
CHANGES: <≤10 lines, what changed and where>
SELF-CHECK: <typecheck/lint result, or the specific condition verified>
```

## After the return

**Read the actual diff** before marking a subtask `[x]`. A subagent's claim that it did
something is not evidence that it did. Then the sanity gate and commit (`CLAUDE.md`). If
the plan is wrong, stop and revise the ticket rather than expanding scope mid-execution.
