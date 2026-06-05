---
id: KIT-T035
title: "Cache consumers trust a stale/corrupt DB; a test leaked DUP fixtures into the real cache"
type: bug
status: todo
priority: high
milestone:
labels: [cache, sqlite, next-id, tests, regression]
links: [KIT-T026, KIT-T031, KIT-T024, KIT-T025]
aka: []
files:
  - scripts/hydrate-db.mjs
  - scripts/next-id.mjs
  - scripts/q.mjs
  - scripts/db-cache.test.mjs
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Description
After KIT-T026 routed `next-id`/orient/drain through the SQLite cache, `next-id` started
returning `<scope>-T001` for real scopes (observed for HOD and KIT). Root cause: the real
`.cache/workflow.db` had been clobbered to contain only `DUP` test fixtures (3 items). Because
the `--if-stale` check is mtime-based and the test wrote the DB *after* the store files, the
Stop-hook hydrate considered it fresh and skipped the rebuild — so consumers served corrupt
data. A manual full re-hydrate restored it (HOD 77 / KIT 32, next-id → KIT-T033).

Two defects:
1. **Test isolation:** a db-cache test (likely the dedup/auto-dedup `DUP` fixtures, KIT-T024/T025)
   wrote to the REAL `<kit-root>/.cache/workflow.db` instead of a temp dbPath.
2. **Consumers trust a stale/invalid cache:** `next-id` (and orient/drain) read the cache without
   ensuring freshness or sanity-checking the result.

## Acceptance Criteria
- [ ] No test ever writes the real `.cache/workflow.db` — all tests use a temp dbPath/registry.
- [ ] `next-id` (at minimum) ensures a fresh cache (`--if-stale` hydrate, ~76ms when fresh,
      ~0.3s full) or falls back to the markdown scan when the requested scope reads empty.
- [ ] Regression test: a stale/empty cache does NOT yield `<scope>-T001` when real tickets exist.

## Notes
- 2026-06-05: Diagnosed live. Hydration is cheap (~0.3s full / ~76ms if-stale), so gating
  next-id on an if-stale hydrate is affordable insurance. The mtime-only staleness check is the
  loophole the test leak slipped through.
