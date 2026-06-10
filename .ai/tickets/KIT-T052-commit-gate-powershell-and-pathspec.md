---
id: KIT-T052
title: commit-gate must fire on PowerShell and judge the commit's pathspec, not the whole dirty tree
type: bug
status: todo
priority: critical
milestone: M1-gate-integrity
labels: [hooks, gates]
files:
  - hooks/hooks.json
  - hooks/commit-gate.mjs
  - scripts/test-hooks.mjs
links: []
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Two holes in the work-log gate:
1. `hooks.json` wires commit-gate to `PreToolUse(Bash)` only, while query-gate matches
   `Bash|PowerShell`. On Windows a `git commit` issued through the PowerShell tool bypasses
   the gate entirely — the primary dev machine defeats the primary enforcement hook.
2. The gate judges the WHOLE dirty tree (diff HEAD + cached + untracked), not the commit's
   pathspec: a path-limited docs-only commit gets blocked when unrelated code is dirty, and
   `git commit <ticket.md>` while code is dirty early-allows.

## Acceptance Criteria
- [ ] commit-gate matcher is `Bash|PowerShell` in hooks.json (and settings.recommended.json stays in sync — see KIT-T069).
- [ ] The gate extracts the pathspec from the commit command and judges only the files actually being committed (fall back to the staged set for a bare `git commit`).
- [ ] Regression tests: PowerShell-issued commit is gated; pathspec-limited docs commit passes with dirty unrelated code; pathspec-limited code commit without citation blocks.
- [ ] Existing test-hooks suite stays green.

## Plan
1. hooks.json matcher fix.
2. Parse pathspec/staged set in commit-gate.mjs; scope the changed-set computation to it.
3. Tests.

## Notes
- 2026-06-09: opened from the full-plugin process review (gate bypass confirmed by inspection of hooks.json:11 vs :15).
