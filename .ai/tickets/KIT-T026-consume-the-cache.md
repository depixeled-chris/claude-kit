---
id: KIT-T026
title: Make the process CONSUME the SQLite cache (query, don't scan) — orient / drain / next-id / index
type: feature
status: todo
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
- [ ] orient surfaces its session view from the cache (open items by scope, recent decisions, in-flight)
      via q.mjs, falling back to markdown scan when the DB/engine is absent.
- [ ] next-id uses the O(1) cache query (KIT-T009 markdown path stays the fallback).
- [ ] index-tickets / drain read from the cache where it's cheaper, fallback preserved.
- [ ] Agent handoffs can point at canned queries ("open items under X", FTS) so agents QUERY instead
      of opening files (the KIT-T020 retrieval win).
- [ ] Never a hard dependency — every consumer works without the cache (fail-open).

## Notes
- 2026-06-04: Found at KIT-T004 landing — hydration is in the process (Stop hook) but consumption is
  not. This ticket realizes the value.
