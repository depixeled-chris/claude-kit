---
id: KIT-T076
title: Cache hardening — q verify (staleness self-check) + DB/fallback parity tests
type: tech-debt
status: todo
priority: medium
milestone:
labels: [cache, q, tests]
files:
  - scripts/q.mjs
  - scripts/hydrate-db.mjs
links: [KIT-T035, KIT-T026]
supersedes:
superseded_by:
created: 2026-06-10T05:30:00Z
updated: 2026-06-10T05:30:00Z
---

## Description
The cache's trust model is assume-fresh: consumers can't tell a current DB from a stale
or fixture-polluted one (the KIT-T035 incident), and the markdown-scan fallback can
silently drift from the DB path because nothing asserts they agree. Two hardenings
(maintainer call, 2026-06-10, from the cache-usefulness review):

1. `q verify` — compare the store manifest (file list + mtimes/hashes) against what the
   DB was hydrated from; report fresh/stale per scope. Cheap enough that orient or q
   itself can run it before answering and degrade to the scan with a one-line notice.
2. Fallback-parity tests — for each query verb (open, fts, trail, governing, rundown),
   assert the DB path and the markdown-scan fallback return the same rows on a fixture
   store. Every future verb gets a parity case or it doesn't merge.

## Acceptance Criteria
- [ ] `q verify [scope]` reports per-scope freshness with the evidence (manifest delta), exit 0 fresh / 1 stale.
- [ ] q (or its callers) surfaces a one-line stale notice instead of silently answering from a stale DB.
- [ ] Parity test file: fixture store → each query verb run through BOTH paths → identical results asserted; wired into npm test.
- [ ] Test-fixture isolation pattern (CLAUDE_PLUGIN_ROOT db redirect, KIT-T058) documented in the test header as the required idiom.

## Plan
1. Manifest snapshot at hydrate time (store alongside the DB) + verify comparator.
2. Stale notice plumbed into q's answer path.
3. Parity fixture + per-verb assertions.

## Notes
- 2026-06-10: opened from the maintainer's cache-usefulness question. Unscheduled
  backlog by design (joins T071-T074, post-M4) — freshness and parity are where this
  system's future bugs live, but nothing corrupts while it waits.
