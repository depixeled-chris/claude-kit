---
id: KIT-T004
title: SQLite query cache — derived, gitignored, one-way hydrated from the markdown stores
type: feature
status: todo
priority: medium
milestone:
labels: [cache, query, sqlite, performance]
links: [KIT-D012]
aka: []
files:
  - scripts/hydrate-db.mjs
created: 2026-06-03T14:20:00Z
updated: 2026-06-03T14:20:00Z
---

## Description
An optional SQLite cache to accelerate graph + full-text queries over the workflow data. The
markdown atomic stores remain the **single source of truth** (git-tracked, diffable, synced);
the DB is a **derived, disposable, gitignored** index hydrated ONE-WAY from the markdown.
Pairs with the relationship graph in [[KIT-D012]] — its value is realized once that graph
(hierarchy, provenance, artifact links) exists, so it sequences AFTER KIT-T003.

## Acceptance Criteria
- [ ] `scripts/hydrate-db.mjs` parses every store across all scopes (incl. LAB) into SQLite:
      items (id, scope, type, status, priority, title, parent), links (from, rel, to), aka,
      artifacts (path, produced_by, informs), history events.
- [ ] DB is **gitignored** and machine-local; a full rebuild is cheap and idempotent
      (`rm` + re-hydrate reproduces it exactly).
- [ ] **No write-back**: nothing writes the DB as truth; all edits go to markdown + re-hydrate.
- [ ] **Optional + fallback**: survey/hooks still work from markdown when the DB (or sqlite) is
      absent — the cache only accelerates; it is never a hard dependency.
- [ ] Engine is `node:sqlite` (Node 22+, zero install) unless a benchmark forces otherwise; the
      DB tool stays out of the hot-path enforcement hooks.
- [ ] Hydration runs on a hook after `.ai` changes + a lazy staleness check (rebuild if any
      store file is newer than the DB).
- [ ] Provides at least: hierarchy rollup, back-link, cross-project rundown, and FTS queries;
      plus an integrity check (orphaned parent / dangling link / status mismatch).

## Open questions (discuss before build)
- Primary driver — query speed, full-text search, or integrity validation? (shapes priority)
- Confirm `node:sqlite` (Node 22+) is acceptable as the floor, vs allowing better-sqlite3.

## Notes
- 2026-06-03: Captured from design discussion. Sequenced AFTER KIT-T003 (the graph) — building
  it now would be speculative; today's data is small enough for in-memory markdown scans.
