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

Drivers (maintainer 2026-06-03): all of query-speed + full-text + integrity — AND, notably,
**agent retrieval**: it's cheaper for Claude to *query* the cache (e.g. "open tickets under
HOD-R045", "bugs introduced by X", FTS) than to open many files into context. The cache is a
retrieval layer, not just a speedup.

## Acceptance Criteria
- [ ] `scripts/hydrate-db.mjs` parses every store across all scopes (incl. LAB) into SQLite:
      items (id, scope, type, status, priority, title, parent), links (from, rel, to), aka,
      artifacts (path, produced_by, informs), history events.
- [ ] **Never checked in.** Always **rebuildable** from the markdown/source files — a full
      rebuild is cheap + idempotent (`rm` + re-hydrate reproduces it exactly).
- [ ] **Location: relative to the claude-kit install**, e.g. `<kit-root>/.cache/workflow.db`
      (via `$CLAUDE_PLUGIN_ROOT`) — NOT in `~/.claude`, NOT in any project repo. Gitignored
      there (`.cache/` already added to claude-kit `.gitignore`).
- [ ] **No write-back**: nothing writes the DB as truth; all edits go to markdown + re-hydrate.
- [ ] **Optional + fallback**: survey/hooks still work from markdown when the DB (or sqlite) is
      absent — the cache only accelerates; it is never a hard dependency.
- [ ] **Engine cascade** (maintainer decided): use `better-sqlite3` if installed, else
      `node:sqlite` (Node 22+); if neither, queries fall back to an in-memory markdown scan
      (hydration needs one of the two). DB tooling stays out of the hot-path enforcement hooks.
- [ ] **Query interface** — a thin `scripts/q.mjs` with named/canned queries (open items,
      children-of, back-links, doc-trail, FTS) + ad-hoc SQL, returning compact results, so an
      agent or human queries the cache instead of opening files.
- [ ] Hydration runs on a hook after `.ai` changes + a lazy staleness check (rebuild if any
      store file is newer than the DB).
- [ ] Provides at least: hierarchy rollup, back-link, cross-project rundown, and FTS queries;
      plus an integrity check (orphaned parent / dangling link / status mismatch).
- [ ] **Next-ID allocation**: an O(1) `next-id <scope> <type>` query (`max(num)+1` over `items`)
      so capture tooling assigns the next ticket/decision/note ID without scanning the dir; flags
      gaps + collisions as part of the integrity check. The dir-scan it replaces is the concrete
      pain that surfaced this, and cheap on-the-fly ID assignment is a prerequisite for the
      request-capture ratchet (log a request mid-turn without a filesystem walk).

## Decided (2026-06-03)
- Drivers: all of speed + FTS + integrity, plus agent-retrieval (query, don't open).
- Engine: prefer `better-sqlite3`, fall back to `node:sqlite`, then markdown scan.

## Notes
- 2026-06-03: Captured from design discussion. Sequenced AFTER KIT-T003 (the graph) — building
  it now would be speculative; today's data is small enough for in-memory markdown scans.
- 2026-06-03: Added next-ID allocation criterion. Surfaced in the HOD session — assigning a
  ticket ID still required a `ls tickets/ | tail` dir scan; ties into the request-capture ratchet
  (KIT, design pending), which needs cheap ID assignment to log requests on the fly. Note: next-ID
  doesn't have to wait for SQLite — `index-tickets.mjs`/INDEX.md can serve it from the markdown
  scan today; the DB just makes it O(1). Flagged so it lands wherever ID assignment is centralized.
- 2026-06-03: The next-ID allocation + collision/integrity criteria LANDED EARLY (markdown
  scan) under **KIT-T009** — `scripts/{id-utils,next-id,check-ids}.mjs` + guards in
  index-tickets/commit-gate/sync-data. This DB ticket now only needs to make those O(1) and
  add the FTS/graph/retrieval queries (still sequenced after KIT-T003). Re-scope when reached.
