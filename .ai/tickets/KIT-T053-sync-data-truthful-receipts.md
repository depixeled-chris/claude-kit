---
id: KIT-T053
title: sync-data must verify the push and handle divergence — no more false "committed + pushed" receipts
type: bug
status: review
priority: critical
milestone: M1-gate-integrity
labels: [hooks, sync, cross-machine]
files:
  - hooks/sync-data.mjs
  - hooks/lib.mjs
links: [KIT-T054]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
sync-data.mjs:50-53 runs add/commit/push and prints `[sync-data] committed + pushed
claude-kit-data` UNCONDITIONALLY — `git()` (lib.mjs:30-36) swallows all errors. Once the
data repo diverges (second machine pushed first), every push fails forever while every
turn claims success. There is no fetch/pull/rebase anywhere, so divergence accumulates
silently. This is the worst kind of enforcement bug: a hook that lies.

## Acceptance Criteria
- [x] Push result is checked; failure is reported on stderr with the actual git error, never a success receipt.
- [x] On rejected push: fetch + rebase (fast-forward-safe), retry once; if still failing, surface loudly and keep the local commit.
- [x] sync-data gets its first test file (success, push-rejected, divergence-rebase paths) wired into `npm test`.
- [x] Receipt is emitted ONLY when something was actually committed/pushed (no-op turns stay silent).

## Plan
1. Add a result-returning git helper (or use existing with status capture).
2. Verify push; fetch/rebase/retry path.
3. Tests with a pair of temp bare/clone repos.

## Notes
- 2026-06-09: opened from the full-plugin process review. The bug class was demonstrated live this session: claude-kit main itself had silently diverged across machines (5cb1cf3 vs 8beb1fa, conflicting edits to pre-write.mjs).
- 2026-06-09: implemented. lib.mjs gained `gitTry()` (result-returning, captures stderr —
  the swallowing `git()` stays for don't-care callers). sync-data verifies commit AND
  push; rejected push → `pull --rebase` + one retry; conflicted rebase → `rebase --abort`
  (never left mid-rebase) + loud `PUSH FAILED` with the real git error; commit failure
  reported as NOT synced; no-remote case says so honestly. Receipts only on actual
  state change (clean repo = silent). hooks/sync-data.test.mjs: bare remote + two-clone
  "machines" fixture, junction-linked project; 8 assertions (no-op silence, happy path +
  remote advance, rejected→rebase→both commits on remote, conflict→PUSH FAILED + local
  commit kept + no mid-rebase state). Wired into npm test; full suite green.
