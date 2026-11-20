# Canonical Operating Manual

This file holds the provider-neutral parts of the agentic development workflow. Harness
adapters may explain invocation and capability limits, but they must not redefine these rules.

## Workflow

```text
classify -> discover -> ticket -> developer approval -> implement -> sanity gate
-> fresh review when warranted -> record decisions -> requested testing -> close
```

1. Classify scope and task type before changing code.
2. Use the project knowledge graph first when configured; confirm claims in real source files.
3. Put plan, file claims, model tier, verification, decisions, and status in one ticket.
4. Obtain approval for non-trivial implementation and its delegation split.
5. Partition implementation by file ownership. An implementation agent changes only its claimed files.
6. Treat typecheck/lint/diff evidence as stronger than an agent completion claim.
7. Use a fresh, read-only reviewer for non-trivial or risk-bearing changes.
8. Run full tests only when requested by the developer or explicitly required by the approved ticket.

## On-demand procedures

Detailed procedures are plain files; read them when the step applies (Claude Code also
auto-loads them as skills). Do not duplicate their text here.

- Writing or editing a ticket: `.claude/skills/ticket/SKILL.md`
- Before writing a plan: `.claude/skills/discovery/SKILL.md`
- Before dispatching an agent: `.claude/skills/dispatch/SKILL.md`
- Resuming in-flight work: `.claude/skills/resume/SKILL.md`
- Running requested tests: `.claude/skills/testing/SKILL.md`
- Before marking `COMPLETED`: `.claude/skills/close-ticket/SKILL.md`
- Split repos or parallel tickets: `.agents/rules/topology.md`

## Safety

- Never overwrite, delete, or claim a project file based on its name alone.
- Installer state may prove tool ownership only when its recorded fingerprint still matches.
- Do not run destructive commands, publish, push, deploy, change remote data, or expose secrets without approval.
- Do not make memory, a proposed lesson, or a scanner finding into permanent policy automatically.
- Keep integrations project-local unless the developer explicitly chooses a global installation.

## Evidence contracts

Implementation return: changed files, concise change summary, and actual command/check result.

Review return:

```text
REVIEW: PASS | FINDINGS | BLOCKED
FINDINGS: severity, file:line, impact, evidence, required action
VERIFICATION GAPS: checks not run and why
OUT-OF-SCOPE CHANGES: path and reason
```

## Behavior book

`ai-workspace/behavior/` holds the current behavior contract per area. Read the affected
area's file before planning; each ticket's B7 section is merged into it at close.

## Memory and lessons

`.agentic/memory/` contains portable, unreviewed local notes. Verify important claims against
code, tickets, or authoritative documentation. Candidate lessons go in
`ai-workspace/lesson-candidates/`; a human must approve promotion into `LESSONS.md` and rules.
