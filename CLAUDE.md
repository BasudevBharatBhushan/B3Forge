# Claude Code Operating Manual

Cross-harness baseline: `AGENTS.md`, `.agentic/core/operating-manual.md` (they win on ownership,
safety, memory, review; this file adds no broader permission). Loaded every session. Binding.
**Design goal: minimum tokens, full context** — one artifact per task, cheap models writing,
an expensive model only judging. Procedures live in skills and `.agents/`, loaded on demand.
`LESSONS.md` holds the failure behind each rule.

## 0. Project Configuration — FILL THIS IN FIRST

Until filled in, **ask rather than guess.** Never infer a command from convention — run it
once, record what it does. `NONE` is a valid value and a planning constraint.

| Key | Value |
|-----|-------|
| `TYPECHECK_CMD` | `<e.g. npx tsc --noEmit / mypy . / go vet ./... / cargo check>` |
| `LINT_CMD` | `<e.g. npm run lint / ruff check / golangci-lint run>` |
| `UNIT_TEST_CMD` | `<the unit test runner — verify it is actually a test runner>` |
| `API_TEST_CMD` | `<the API/integration test runner, or NONE if not wired>` |
| `BUILD_CMD` | `<the build command, if distinct from typecheck>` |
| Repo topology | `<single-repo / monorepo / split-repo — see .agents/rules/topology.md>` |
| Packages | `<the top-level packages or apps, e.g. web, api, worker>` |
| Scope types | `<the valid scope classifications for this project — see Scope & Type>` |
| `Parallel isolation` | `<same-branch / branch-per-ticket / worktree-per-ticket — see .agents/rules/topology.md>` |

Implementation agents are fixed: `impl-small`, `impl-mid` (`.claude/agents/`). Their `model:`
frontmatter binds the tier; change a tier by editing that file, never by prompting.

## 1. Workflow

```
prompt → scope + type → graph discovery → ticket (plan, subtasks, `subagent_type` each, test cases)
  → DEVELOPER APPROVAL (plan + delegation split) → subagent execution, one subtask at a time
  → sanity gate every subtask: typecheck · lint · diff read → commit → verification → graph refresh
  → AWAITING_TEST → [ tests ONLY on explicit request, max 3 fix cycles ] → COMPLETED
```

## 2. Hard Rules

- **No implementation without an approved ticket.** `module-addition`: the parent's approval
  covers children unless a child's Deviation Check fails (reopens that child only).
- **Orchestrator never writes code.** Dispatch only `Agent` with `subagent_type` `impl-small`
  or `impl-mid` — never general-purpose/claude/Explore/Plan, never a `model` override.
- Default to `impl-small`; promote to `impl-mid` only per the tiering test.
- **Partition by file**, including across tickets (`Files:` header = claim; check `active-tickets`).
- **One wave per response**; read every diff before `[x]`.
- Write `[~]` and `Current subtask:` in the ticket **before** dispatching.
- Only files in the plan; no unplanned refactors, new frameworks, or silent architecture
  changes; **never change existing UI design without approval.** Plan wrong → stop, revise ticket.
- **Tests only on explicit request** (`/testing`). Max 3 fix cycles. Never edit, weaken, skip,
  or delete an assertion to reach green.
- **Sanity gate, every subtask:** `TYPECHECK_CMD` in the affected package · `LINT_CMD` on touched
  files only · diff read. Then **commit** in the affected repo: `T-NNN.S — <what achieved>`,
  that subtask's files only. Commit is local; **push needs approval.** Start from a clean tree
  — dirty on arrival means ask.

## 3. Scope & Type

Classify both first. Scope: frontend / backend / fullstack (only if truly both, incl. the API
contract the UI depends on); adjust in §0. Record the type in the ticket's `Type:` line.
Unclear → ask. Selecting a type means invoking its skill.

| Type | Skill |
|------|-------|
| `module-addition` (new bounded domain) | `/module-addition` + `MODULE_TICKET_TEMPLATE.md` |
| `feature-addition` | `/feature-addition` |
| `enhancement` (intentional change) | `/enhancement` |
| `bug-fix` (violates spec; Part B leads with root cause) | `/bug-fix` |
| `refactor` (behavior-preserving) | `/refactor` |
| `migration` · `chore` (lighter discovery) · `security-fix` (own urgency) | — |

## 4. Skill Triggers — load, don't recall

| When | Load |
|------|------|
| Before writing or editing a ticket | `/ticket` |
| Before writing a plan | `/discovery` |
| Before dispatching a subagent | `/dispatch` |
| Session starts with a ticket in flight | `/resume` |
| Before setting COMPLETED | `/close-ticket` |
| Developer asks for tests | `/testing` |
| Viewport audit | `/ui-responsiveness` |

A skill that contradicts this file is wrong.

## 5. Standing Rules

- **Communication.** Brief a technical manager: outcome first, short bullets, only what the
  decision needs, no repetition or dumps; detail when asked. Conversation only — files follow
  templates; the dispatch return format wins.
- **Database.** Never CRUD a real database. Schema change → SQL to
  `ai-workspace/sql/NNN_description.sql`, developer reviews and runs it, then update
  `ai-workspace/docs/db-architecture.md`.
- **Irreversible/outward.** Local reversible work proceeds. Ask first for: `git push --force`,
  `git reset --hard`, amending pushed commits, deleting branches or files you didn't create,
  `rm -rf`, dropping tables, anything leaving the machine (push, PR open/comment, external
  posts). Never `--no-verify` or discard unfamiliar working-tree changes.
- **API contracts.** Document every new/changed endpoint in `ai-workspace/docs/api/`; keep
  layer order (`backend.md`).
- **Time.** Dates involved → `.agents/rules/timezone.md` (client timezone, never server local, store UTC).
- **Environment.** Never hardcode credentials, keys, IDs, secrets, URLs, test inputs — use
  env/config, including scratch scripts. Missing variable → ask; never edit env files.
- **General.** Minimal safe changes, no cleanup beyond scope · keep backward compatibility ·
  no repo-wide changes without approval · clarify ambiguity, never guess · scratch scripts in
  `temp/`, deleted when done.

## 6. Load On Demand

Never preload. Missing doc → stop and ask.

| Doc | Load when |
|-----|-----------|
| `.agents/rules/coding-guidelines.md` | any implementation |
| `.agents/rules/frontend.md` / `backend.md` | frontend / backend scope |
| `.agents/rules/database.md` · `timezone.md` | DB changes · date/time logic |
| `.agents/rules/topology.md` | split repo, monorepo, parallel tickets |
| `.agents/rules/graphify.md` | graph setup, advanced queries |
| `.agents/templates/EXAMPLE_TICKET.md` | first ticket, or unsure of detail |
| `.agents/rules/karpathy.md` | large or ambiguous change |
| `LESSONS.md` | a rule looks like overhead or you'd weaken one |
| `.agents/rules/rules.md` · `workflows/workflow.md` | auditing the rules / workflow |
| `ai-workspace/docs/db-architecture.md` | schema work |

## Compact Instructions

Preserve verbatim when compacting: the §0 table · this session's ticket ID, path, status, and
`Current subtask:` line incl. agent IDs · its non-goals · which subtasks are `[ ]`, `[~]`, `[x]`.
Summarize the rest; it is recoverable from the ticket and `git log`.
