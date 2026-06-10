---
id: KIT-T082
title: Branch-switch guard — block git switch / checkout -b in a shared checkout; force worktrees for parallel agents
type: feature
status: review
priority: critical
milestone:
labels: [hooks, gates, git, safety]
links: [KIT-T021]
files:
  - hooks/branch-guard.mjs
  - hooks/hooks.json
supersedes:
superseded_by:
created: 2026-06-10T18:09:56Z
updated: 2026-06-10T18:19:56Z
---

## Description
Maintainer (2026-06-10, verbatim frustration): "ANY TIME an agent is working on a feature
branch, I need a hook to stop them. TOO MANY TIMES I have multiple agents working on the same
codebase and ONE of them flips the entire repo to a feature branch and FUCKS UP EVERYTHING."

Multiple agents share ONE working tree. A `git switch`/`git checkout -b` flips that shared
checkout out from under every other agent — corrupting their in-flight work. The right model
for parallel agents is an isolated **git worktree** (cf. the Agent tool's `isolation: worktree`),
NOT flipping the shared branch. So: a hard PreToolUse gate that blocks a branch flip in a shared
checkout and points to worktrees, with a deliberate, logged escape.

## Acceptance Criteria
- [x] PreToolUse(Bash|PowerShell) `branch-guard.mjs` BLOCKS (exit 2) a branch flip: `git switch <x>`, `git switch -c <x>`, `git checkout -b|-B <x>`, and `git checkout <ref>` where <ref> resolves to an existing branch. Message names the safe path (git worktree) + the escape.
- [x] Does NOT block file-restore checkouts (`git checkout -- <file>`, `git checkout <path>`), `git worktree add`, `git branch` (list/create-without-switch), or non-git commands.
- [x] Deliberate escape: an inline `[allow-branch: <reason>]` token in the command (mirrors `[no-log:]`/`[no-test:]`) OR env `CLAUDE_KIT_ALLOW_BRANCH=1`.
- [x] Only fires on adopted (.ai) repos; fail-open on any parse/git error per HOOK CONTRACT (a broken guard must never wedge a shell command).
- [x] Wired into hooks.json PreToolUse for Bash AND PowerShell.
- [x] Tests: each blocked form, each allowed form, the escape, fail-open, non-adopted no-op.

## Plan
1. hooks/branch-guard.mjs: parse the git subcommand, classify flip vs file-op, resolve refs via `git show-ref`/`rev-parse`. Escape + adopted + fail-open.
2. Wire into hooks.json (PreToolUse Bash|PowerShell).
3. Tests in test-hooks.mjs.

## Notes
- 2026-06-10: SHIPPED, same turn the maintainer raised it. hooks/branch-guard.mjs classifies
  each git segment: `switch` (any operand) and `checkout -b|-B` always flip; plain `checkout
  <op>` flips only when `refs/heads/<op>` resolves (so a FILENAME never reads as a branch — the
  classic checkout ambiguity is sidestepped; a `--` makes it a file op). worktree/branch/non-git
  pass the fast-out. Escape: `[allow-branch: reason]` or `CLAUDE_KIT_ALLOW_BRANCH=1`. Adopted-only
  + fail-open (any error → exit 0). Wired in hooks.json AND user-config/settings.recommended.json
  (Bash|PowerShell — the bootstrap mirror is otherwise stale, full reconcile is KIT-T069). Tests:
  13 cases in scripts/test-hooks.mjs (every block/allow form, both escapes, wiring, non-adopted).
  Full suite green. NOTE the bound: this guards a FLIP of the shared tree; a detached-HEAD
  checkout of a bare sha/tag is out of v1 scope (the maintainer's pain is feature branches).

## History
- [2026-06-10 18:09] (created) feature — Branch-switch guard — block git switch / checkout -b in a shared checkout; force worktrees for parallel agents
- [2026-06-10 18:15] (status) todo → doing
- [2026-06-10 18:19] (comment) ticked: PreToolUse(Bash|PowerShell) `branch-guard.mjs` BLOCKS (exit 2) a branch flip: `git switch <x>`, `git switch -c <x>`, `git checkout -b|-B <x>`, and `git checkout <ref>` where <ref> resolves to an existing branch. Message names the safe path (git worktree) + the escape.
- [2026-06-10 18:19] (comment) ticked: Does NOT block file-restore checkouts (`git checkout -- <file>`, `git checkout <path>`), `git worktree add`, `git branch` (list/create-without-switch), or non-git commands.
- [2026-06-10 18:19] (comment) ticked: Deliberate escape: an inline `[allow-branch: <reason>]` token in the command (mirrors `[no-log:]`/`[no-test:]`) OR env `CLAUDE_KIT_ALLOW_BRANCH=1`.
- [2026-06-10 18:19] (comment) ticked: Only fires on adopted (.ai) repos; fail-open on any parse/git error per HOOK CONTRACT (a broken guard must never wedge a shell command).
- [2026-06-10 18:19] (comment) ticked: Wired into hooks.json PreToolUse for Bash AND PowerShell.
- [2026-06-10 18:19] (comment) ticked: Tests: each blocked form, each allowed form, the escape, fail-open, non-adopted no-op.
- [2026-06-10 18:19] (status) doing → review
