---
id: KIT-T054
title: orient detects diverged branches (fetch + ahead/behind); Stop hook nags on unpushed work
type: feature
status: review
priority: high
milestone: M1-gate-integrity
labels: [hooks, sync, cross-machine]
files:
  - hooks/orient.mjs
  - hooks/lib.mjs
links: [KIT-T053]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
`wipSummary` (lib.mjs:63-71) computes ahead-only (`git log --branches --not --remotes`);
nothing ever fetches, so a diverged main is invisible until `git pull` fails mid-task.
The contract says "push at every task boundary" but only commits are gated — unpushed
work has no enforcement at all. This session's pre-write.mjs merge conflict was the
direct cost: two machines independently rewrote the same code because neither was told
the other had moved.

## Acceptance Criteria
- [x] orient runs a bounded `git fetch` (short timeout, fail-open offline) and reports ahead/behind/DIVERGED per branch in the orientation block.
- [x] A diverged state is flagged loudly at the top ("rebase before working"), not buried in the WIP list.
- [x] Stop hook (or housekeeping) warns when unpushed commits exist at end of turn past a threshold (count or age) — nag, not block.
- [x] Tests cover ahead-only, behind-only, diverged, and offline (fetch fails → fail-open, ahead-only view).

## Plan
1. lib: aheadBehind(repo) with fetch + `rev-list --left-right --count`.
2. orient wiring + prominent diverged banner.
3. Stop-hook unpushed nag.
4. Tests.

## Notes
- 2026-06-09: opened from the full-plugin process review.
- 2026-06-09: implemented. lib.mjs `aheadBehind(repo, {fetch})`: bounded fetch (4s
  timeout, swallowed on failure → counts run against last-known refs), `rev-list
  --left-right --count HEAD...@{upstream}`; null on no-upstream/detached. orient: per-repo
  `vs origin: ahead X / behind Y` line (only when behind/diverged — quiet when merely
  ahead, the WIP list already shows that) + `!! DIVERGED FROM ORIGIN` banner spliced
  directly under the orientation header. housekeeping Stop: nags at >= 3 unpushed commits
  on adopted repos WITH a remote (remote-less repos exempt — all noise), fail-open.
  Tests: 7 new in test-hooks (behind-only / diverged / ahead-only / offline-fail-open /
  no-upstream-null / nag fires / nag quiet on clean). 42/42 + full suite green.
