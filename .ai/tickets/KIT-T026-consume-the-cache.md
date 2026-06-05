---
id: KIT-T026
title: Make the process CONSUME the SQLite cache (query, don't scan) — orient / drain / next-id / index
type: feature
status: review
priority: high
labels: [cache, query, performance, orient, drain]
links: [KIT-T004, KIT-T020, KIT-T023]
files: [hooks/orient.mjs, scripts/index-tickets.mjs, scripts/next-id.mjs, commands/drain.md]
created: 2026-06-04T15:45:00Z
updated: 2026-06-04T15:45:00Z
---

## Description
KIT-T004 built the cache + wired HYDRATION (Stop-phase hook, both install paths). But nothing
CONSUMES it: orient, drain, index-tickets, and next-id still scan markdown. The cache is fresh but
unused, so the perf + agent-retrieval/token win isn't realized. Wire the process to QUERY the cache
(via q.mjs / the DB) with the markdown-scan as fallback.

## Acceptance Criteria
- [x] orient surfaces its session view from the cache (open items by scope, recent decisions, in-flight)
      via q.mjs, falling back to markdown scan when the DB/engine is absent.
- [x] next-id uses the O(1) cache query (KIT-T009 markdown path stays the fallback).
- [~] index-tickets / drain read from the cache where it's cheaper, fallback preserved.
      (drain.md now points at q.mjs canned queries; index-tickets NOT migrated — design fork, see Notes.)
- [x] Agent handoffs can point at canned queries ("open items under X", FTS) so agents QUERY instead
      of opening files (the KIT-T020 retrieval win).
- [x] Never a hard dependency — every consumer works without the cache (fail-open).

## Notes
- 2026-06-04: Found at KIT-T004 landing — hydration is in the process (Stop hook) but consumption is
  not. This ticket realizes the value.
- 2026-06-04: Implemented. ONE shared programmatic entry — `query(cmd, args, {root, noDb})` exported
  from `scripts/q.mjs` — runs a canned cache query and FAILS OPEN to the db-parse markdown scan when
  no SQLite engine/DB exists (the CLI `main()` now goes through it too, so cache-vs-scan parity lives
  in one place). Consumers routed:
    * `scripts/next-id.mjs` → cache `next-id` (O(1) max(num)+1) pinned to this scope via `--root`;
      falls back to `id-utils.nextId` scan. Store-validation + ids.key read up front stay scan-cheap
      so bad-store / missing-key errors are unchanged (verified live).
    * `hooks/orient.mjs` (SessionStart — NOT an enforcement hot path; allowed) → new "Open work"
      section from cache `open`, grouped by scope + this-scope in-flight (doing/review); wrapped in
      try/catch so a cache hiccup never blocks orientation. Live: `by scope: HOD:48 KIT:31`.
    * `commands/drain.md` → step 1 now points the agent at `q.mjs open <scope>` / `q.mjs rundown`
      (QUERY, don't open every ticket — the KIT-T020 retrieval win), with the fallback noted.
- PARITY FIX: the pre-existing `open` query disagreed cache-vs-scan on ordering (SQL `ORDER BY
  priority, id` text vs fallback `compareIds`-only). Unified BOTH on one `compareOpen` comparator
  (priority code-point order, then id NUMERICALLY) applied in JS on both paths — removes the
  text-vs-numeric id gap (>999 ids) too.
- TEST: extended `scripts/db-cache.test.mjs` with hermetic-temp-dir parity tests asserting
  cache-backed == markdown-scan for `open`, `rundown`, and `next-id` (and next-id == `nextId()`),
  via `query(..., {root})` vs `query(..., {root, noDb:true})`, JSON-normalized (node:sqlite returns
  null-prototype rows). db-cache: 20 passed, 0 failed. Full suite green (`npm test` exit 0).
- DESIGN FORK (index-tickets NOT migrated): `scripts/index-tickets.mjs` GENERATES INDEX.md /
  REGRESSIONS.md / ROADMAP.md and needs `causing_commit` + `fixed_commit` for the regression chains —
  those columns are NOT in the cache schema (the `items` table omits them; `regressed_from` is only an
  edge in `links`). It also already reads every ticket once into memory, so routing it to the cache
  would add a second data source for data it already holds, with no read-path win (it's a write tool,
  run on demand, not a hot read). Migrating it would require either a schema extension (add
  causing/fixed/regressed columns) or a hybrid scan+cache read. Left as scan; flagged for the
  maintainer to decide whether the schema grows.
