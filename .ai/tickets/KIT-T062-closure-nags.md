---
id: KIT-T062
title: Make the system as loud about unfinished work as it is about uncaptured work (closure nags)
type: feature
status: doing
priority: high
milestone: M2-close-the-loop
labels: [hooks, lifecycle]
files:
  - hooks/housekeeping.mjs
  - hooks/orient.mjs
links: [KIT-T054, KIT-T060]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T20:58:09Z
---

## Description
housekeeping nags about exactly two things (memory review, maintenance-gaps review) —
neither of which is what actually rots. The live store proves the gap: 25 inbox items
sat 3 days with no nag (untriaged inbox is surfaced only at PreCompact), 23 tickets
stuck in review, SESSION.md 6 days stale and naming the wrong active ticket while the
contract calls a stale plan-of-record "itself a failure".

Add to SessionStart nagging:
- inbox items older than N days (count + oldest age),
- review queue size + oldest age ("waiting on YOUR /done"),
- SESSION.md staleness: orient warns when SESSION's date predates the last commit.

## Acceptance Criteria
- [x] Inbox-age nag with configurable threshold (default 2 days), per project.
- [x] Review-queue nag (count + oldest) phrased as waiting-on-human — review IS the UAT stage (KIT-D033).
- [x] UAT-queue presentation is FREQUENT (maintainer directive 2026-06-10): SessionStart (full list when small, count+oldest when large) AND Stop (one line when the queue grew this turn). Every session — not weekly-review cadence. Applies where `config.uat` resolves `required` (KIT-D034); a `uat: none` project accumulates no queue, so the nag is naturally silent there.
- [x] orient emits a one-line SESSION-stale warning when SESSION.md mtime/date < last commit date.
- [x] Nags are one line each, capped, and silent when clean (no noise tax).
- [x] Tests for each threshold (fresh = silent, stale = nag).

## Plan
1. housekeeping: inbox + review scanners (reuse survey.mjs data where possible).
2. orient: SESSION staleness check.
3. Tests.

## Notes
- 2026-06-09: opened from the lifecycle review — "the intake side is over-built, the closure side is barely built."
- 2026-06-10: maintainer directive (interjection): "Are we supporting a UAT status now?
  That needs to be presented to me frequently." → KIT-D033 (review IS UAT; no separate
  status) + the frequency criterion above. Priority of this ticket effectively rises:
  it now carries a standing maintainer expectation.
- 2026-06-10: LANDED. Shared scanners added to `hooks/lib.mjs` (`scanInbox`, `scanReviewQueue`
  with per-ticket uat resolution + `uatDefault` reader, `readTurnState`/`writeTurnState` keyed
  by repo under a temp dir, `sessionStale`) — all fail-open. `hooks/housekeeping.mjs`:
  SessionStart now nags on un-triaged inbox (≥ `INBOX_STALE_DAYS`=2, count + oldest) and on the
  review/UAT queue (short id-list when small via `REVIEW_LIST_MAX`=6, else count + oldest;
  "waiting on YOUR `/done`"), and snapshots the review count; Stop adds a one-liner ONLY when the
  queue GREW this turn. `hooks/orient.mjs`: one-line SESSION-stale banner when SESSION mtime <
  last-commit date. All gated on `config.uat` resolving `required`, so claude-kit's own
  `uat: none` is naturally SILENT (verified live: inbox nag fires on the real store, review nag
  does not). 14 new cases in `scripts/test-hooks.mjs` (fresh=silent / stale=nag for inbox,
  review, SESSION; uat=none silence; Stop-grew) — full suite `node scripts/test-hooks.mjs`:
  101 passed, 0 failed.

## History
- [2026-06-10 20:58] (status) todo → doing
- [2026-06-10 21:07] (comment) ticked: Inbox-age nag with configurable threshold (default 2 days), per project.
- [2026-06-10 21:07] (comment) ticked: Review-queue nag (count + oldest) phrased as waiting-on-human — review IS the UAT stage (KIT-D033).
- [2026-06-10 21:07] (comment) ticked: UAT-queue presentation is FREQUENT (maintainer directive 2026-06-10): SessionStart (full list when small, count+oldest when large) AND Stop (one line when the queue grew this turn). Every session — not weekly-review cadence. Applies where `config.uat` resolves `required` (KIT-D034); a `uat: none` project accumulates no queue, so the nag is naturally silent there.
- [2026-06-10 21:07] (comment) ticked: orient emits a one-line SESSION-stale warning when SESSION.md mtime/date < last commit date.
- [2026-06-10 21:07] (comment) ticked: Nags are one line each, capped, and silent when clean (no noise tax).
- [2026-06-10 21:07] (comment) ticked: Tests for each threshold (fresh = silent, stale = nag).
