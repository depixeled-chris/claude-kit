---
id: KIT-T081
title: "GIT WORKFLOW 'branch first' default is wrong for multi-agent shared-FS repos — must mandate worktrees/trunk, not feature branches"
type: bug
status: todo
priority: high
labels: [process, git, multi-agent, worktrees, contract]
files:
  - user-config/CLAUDE.global.md
links: [KIT-T079, KIT-T080]
supersedes:
superseded_by:
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Description
Lived failure (hustle-or-die, 2026-06-10), maintainer: "I've said it dozens of times… multiple agents
CAN'T use feature branches on the same file system. PROCESS FAILURE." Multiple Claude sessions run
against ONE on-disk checkout (one git HEAD, one index). The global GIT WORKFLOW guidance — *"If on the
default branch, branch first"* — and the harness's branch-first nudge ASSUME one-checkout-per-agent.
On a shared filesystem that assumption is false and the advice is actively harmful:

- A concurrent (game) session had switched the shared HEAD from `roads-wip` to `feat/building-editor-
  t113`; this session started believing it was still on `roads-wip`.
- Both sessions committing on that one branch shared the INDEX — this session's staged `tools/`
  deletions got swept into the game session's unrelated `74c48df` commit.
- `main` ended up 45 commits behind the feature branch (sprawl); no clean trunk.

The repo already provisions the correct mechanism — `worktree-agent-*` branches (separate dirs) — but
nothing steers agents INTO worktrees and AWAY from feature-branching the shared checkout.

## Acceptance Criteria
- [ ] Global contract states the rule: on a shared multi-agent checkout, do NOT create/switch feature
      branches; work on the trunk and isolate parallel work via git WORKTREES. Mark it as OVERRIDING
      the "branch first" line for this topology.
- [ ] The "branch first" guidance is scoped to single-checkout repos (or removed), so it stops firing
      the wrong reflex in shared-FS repos.
- [ ] Consider a hook: warn/block `git checkout -b` / `git switch -c` / branch-switch in a checkout
      detected as shared (e.g. sibling worktrees present), pointing at the worktree flow.
- [ ] Detection note: how an agent recognizes a shared checkout (presence of `worktree-agent-*` /
      `git worktree list` > 1) so it self-selects the worktree path.

## Notes
- Mirrored in the hustle-or-die project memory `no-feature-branches-shared-fs.md` (the agent-facing
  rule). This ticket is the systemic/contract fix so the reflex changes, not just one project's memo.
- Third in a 2026-06-10 cluster of retrieval/process bugs (KIT-T079 provenance, KIT-T080 query-gate).

## History
- [2026-06-10 00:00] (created) branch-first-vs-shared-FS process bug; status→todo.
