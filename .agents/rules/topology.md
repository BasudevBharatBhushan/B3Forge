---
trigger: manual
description: Repository topology and parallel-isolation modes. Load for split-repo or monorepo work, or when more than one ticket is in flight.
---

# Repository Topology

Declared in the `CLAUDE.md` §0 config table. Rules say "the affected package" rather than
naming directories, so they hold for single repo, monorepo (scope and gate per package), and
split repos under one parent — each subdirectory its own git repo:

- `cd` into the specific repo before any git command
- commit and push within that repo only
- **never** commit across repos from the parent
- shared `ai-workspace/` lives at the parent, no nested copies

**One authority.** A subdirectory's own rules/workflow doc is a *view* of `CLAUDE.md`;
anything describing a superseded process carries a superseded banner.

## Parallel tickets

Declare `Parallel isolation` in the `CLAUDE.md` §0 table.

- `same-branch` — concurrent tickets interleave commits on one branch; only sound when their
  file claims are disjoint, and reverting one ticket means picking its commits out by hand.
- `branch-per-ticket` — one branch per ticket, merged at closure, so each ticket stays
  revertible as a unit.
- `worktree-per-ticket` — a separate working directory per branch, so two sessions never
  share a tree; the strongest isolation and the only one that removes the file-claim hazard
  outright, at the cost of a checkout per ticket.

A worktree gets its own `ai-workspace/`: designate one tree (normally the primary checkout)
as authoritative for the ticket registry rather than editing per-tree copies.
