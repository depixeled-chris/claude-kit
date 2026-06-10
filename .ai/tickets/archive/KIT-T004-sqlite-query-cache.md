---
id: KIT-T004
title: SQLite query cache — derived, gitignored, one-way hydrated from the markdown stores
type: feature
status: done
priority: high
milestone:
labels: [cache, query, sqlite, performance]
links: [KIT-D012, KIT-T003, KIT-T020, KIT-T023, KIT-T024, KIT-T025]
aka: []
files:
  - scripts/hydrate-db.mjs
  - scripts/q.mjs
  - scripts/db-engine.mjs
  - scripts/db-parse.mjs
  - scripts/db-cache.test.mjs
  - hooks/hydrate-cache.mjs
  - hooks/hooks.json
  - user-config/settings.recommended.json
  - package.json
created: 2026-06-03T14:20:00Z
updated: 2026-06-10T06:00:00Z
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
- [x] `scripts/hydrate-db.mjs` parses every store across all scopes (incl. LAB) into SQLite:
      items (id, scope, type, status, priority, title, parent), links (from, rel, to), aka,
      artifacts (path, produced_by, informs), history events.
- [x] **Never checked in.** Always **rebuildable** from the markdown/source files — a full
      rebuild is cheap + idempotent (`rm` + re-hydrate reproduces it exactly).
- [x] **Location: relative to the claude-kit install**, e.g. `<kit-root>/.cache/workflow.db`
      (via `$CLAUDE_PLUGIN_ROOT`) — NOT in `~/.claude`, NOT in any project repo. Gitignored
      there (`.cache/` already added to claude-kit `.gitignore`).
- [x] **No write-back**: nothing writes the DB as truth; all edits go to markdown + re-hydrate.
- [x] **Optional + fallback**: survey/hooks still work from markdown when the DB (or sqlite) is
      absent — the cache only accelerates; it is never a hard dependency.
- [x] **Engine cascade** (maintainer decided): use `better-sqlite3` if installed, else
      `node:sqlite` (Node 22+); if neither, queries fall back to an in-memory markdown scan
      (hydration needs one of the two). DB tooling stays out of the hot-path enforcement hooks.
- [x] **Query interface** — a thin `scripts/q.mjs` with named/canned queries (open items,
      children-of, back-links, doc-trail, FTS) + ad-hoc SQL, returning compact results, so an
      agent or human queries the cache instead of opening files.
- [x] Hydration runs on a hook after `.ai` changes + a lazy staleness check (rebuild if any
      store file is newer than the DB).
- [x] Provides at least: hierarchy rollup, back-link, cross-project rundown, and FTS queries;
      plus an integrity check (orphaned parent / dangling link / status mismatch).
- [x] **Next-ID allocation**: an O(1) `next-id <scope> <type>` query (`max(num)+1` over `items`)
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
- 2026-06-04: PRIORITY medium→high. Maintainer: "going to be important for performance pretty
  soon." It's now an ENABLER, not just a speedup: the dedup/supersede/active-surfacing work
  (KIT-T023/T024/T025) all need to QUERY the stores (similarity, supersede chains, topical lookup),
  and the agent-retrieval angle ("query the cache, don't open files") directly serves token-efficient
  handoffs (KIT-T020). Stores are growing (25+ active tickets, index re-scans every run). Still
  sequences after the graph (KIT-T003), but both are now near-term.
- 2026-06-04 DIRECTIVE: BORROW from `D:\dev\workflow` (the maintainer's own repo — borrow freely,
  no license concern). It has a Prisma/SQLite schema (server/prisma/schema.prisma: items/tasks,
  assignments, blockers, comments, activity, worklogs) + query services (assignments/comments/
  activity.service.ts) the workflow-orchestrator study already mapped. Adapt its schema shape +
  query services to KIT's model — KEY DIFFERENCE: workflow is DB-as-truth (Prisma); KIT is
  markdown-as-truth + a DERIVED/gitignored cache hydrated one-way (per this ticket). So borrow the
  schema + query/FTS/graph code, NOT the write-back/ORM-as-source. Also seeds KIT-T003 (the graph).
- 2026-06-04 BUILT (status → review). Files: `scripts/{db-engine,db-parse,hydrate-db,q,db-cache.test}.mjs`,
  `hooks/hydrate-cache.mjs`, wiring in `hooks/hooks.json` + `user-config/settings.recommended.json` (Stop),
  `package.json` test. Borrowed from workflow + adapted:
  - SCHEMA (server/prisma/schema.prisma): workflow's Project+Task → one `items` table keyed by markdown id
    (scope split out of the id prefix, replacing workflow's Project FK); Comment.parentId threading + Task
    relations → generalized `links(from,rel,to)` edge table; Document/Decision provenance → `artifacts`;
    activity.service's UNION-of-events timeline → materialized `history` table; substring search → FTS5.
  - SERVICES: `open` ← assignments/blockers.service getX(params) WHERE-filter; `children`/`backlinks` ←
    comments.service parentId tree walk (upward-stored parent, downward-generated view per KIT-D012);
    `doc-trail` ← activity.service per-task desc timeline; `next-id`/`integrity` realize KIT-T009 as O(1) SQL.
  - DROPPED (KIT difference): the Prisma ORM, all write-back, DB-as-source. Full drop+rebuild each hydrate;
    `q.mjs sql` rejects anything but SELECT/WITH/PRAGMA/EXPLAIN.
  - Engine cascade better-sqlite3 → node:sqlite → markdown scan; ran on node:sqlite (Node 25, better-sqlite3
    not installed). Every canned query has a db-parse fallback (`q.mjs --no-db` forces it). Hook is Stop-phase,
    lazy-stale, fail-open — NOT in the PreToolUse/commit-gate hot path.
  - VERIFIED: hydrated 43 real items; ran open/children/backlinks/fts/next-id/rundown/integrity/sql; proved
    `rm` + re-hydrate is bit-identical on logical content; fallback parity via `--no-db`; 15 new tests green,
    full suite 75/0. FIX during build: switched FTS5 from contentless (`content=''`, which returns no
    snippet/columns) to a standalone FTS table.
- 2026-06-04 BUGFIX (KIT-T031): the "every store across ALL scopes" AC was VIOLATED in practice —
  hydration was single-root (CLI default `process.cwd()`, Stop hook `gitRoot()`), so the one shared DB was
  last-writer-wins per repo (in HOD it held only HOD's 73 items; `next-id KIT` returned 1, integrity
  false-flagged KIT-T023). Fixed under KIT-T031: `hydrate()` now defaults to a cross-scope UNION over every
  registered project + claude-kit's own .ai (new `projectAiDirs()` in lib.mjs reusing `readRegistry`; an
  `aiDir` override threaded through collectItems/scanStores/readIdConfig for central-data stores). `--root`
  still forces single-scope; `q.mjs` auto-hydrate + the `hydrate-cache.mjs` Stop hook are now cross-scope.
  Live: 124 items, HOD 73 / KIT 51 in one DB; +2 cross-scope tests (db-cache 17/0).
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
