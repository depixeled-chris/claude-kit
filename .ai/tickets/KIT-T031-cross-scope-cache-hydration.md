---
id: KIT-T031
title: Cross-scope cache hydration — one DB indexes every project, queryable from any cwd
type: bug
status: review
priority: high
milestone:
labels: [cache, query, sqlite, bug]
links: [KIT-T004]
aka: []
files:
  - scripts/hydrate-db.mjs
  - scripts/q.mjs
  - scripts/db-parse.mjs
  - scripts/id-utils.mjs
  - scripts/db-cache.test.mjs
  - hooks/hydrate-cache.mjs
  - hooks/lib.mjs
created: 2026-06-04T00:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Description
The KIT-T004 SQLite query cache hydrated only ONE project's stores at a time. `scripts/hydrate-db.mjs`
defaulted `root` to `process.cwd()` and the Stop hook `hooks/hydrate-cache.mjs` passed `root = gitRoot()`,
so the single shared DB at `<kit-root>/.cache/workflow.db` was **last-writer-wins per repo**. Sitting in
HOD, the DB held only HOD's 73 items: `q.mjs next-id KIT tickets` returned `1`, and `q.mjs integrity`
flagged `KIT-T023` as a dangling link because every KIT item was absent. KIT-T004's AC requires "every
store across ALL scopes (incl. LAB)" — the cache silently violated that the moment a second project ran.

## Acceptance Criteria
- [x] One DB indexes EVERY registered scope (registry projects + central data + claude-kit's own .ai),
      unioned into the shared `<kit-root>/.cache/workflow.db`.
- [x] Queries return the right answer regardless of cwd (e.g. `next-id KIT tickets` and `integrity` are
      correct when run from inside HOD).
- [x] The single-root `--root <dir>` override still works (single-scope hydrate for tests / isolation).
- [x] The Stop hook (`hydrate-cache.mjs`) hydrates ALL scopes, not just `gitRoot()`.
- [x] `--if-stale` staleness considers all hydrated roots (rebuild if any store under any scope is newer).
- [x] An automated test proves cross-scope hydration: after hydrate, items from ≥2 scopes are present and
      queryable, using temp `.ai` dirs (no machine-specific absolute paths).
- [x] No reinvented registry parsing — reuse the existing `readRegistry` via a shared enumeration helper.

## Notes
- 2026-06-04: ROOT CAUSE — `hydrate()` was single-root; both entry points (CLI default cwd, hook gitRoot)
  hydrated one repo, dropping+rebuilding the shared DB each turn. Fix: hydrate a UNION of sources.
- 2026-06-04: Added `projectAiDirs()` to `hooks/lib.mjs` — the cross-project enumeration shared with
  survey, built on the existing `readRegistry` (no new registry parsing). It resolves each project to its
  `.ai` dir: `<repo>/.ai` when opened on this machine, else the central data dir `<dataRoot>/projects/<name>`
  (which IS the `.ai` dir, not a parent of one).
- 2026-06-04: Threaded an `aiDir` override through `collectItems` / `scanStores` / `readIdConfig` so a
  central-data store (no nested `.ai`) parses directly. `hydrate()` now defaults to cross-scope: it unions
  every source via `hydrationSources(root)` (kit + all registered projects, de-duped by aiDir), dedups by
  id, and records all source roots in `meta.source_root`. `--root <dir>` still forces single-scope.
- 2026-06-04: `q.mjs` auto-hydrate is now cross-scope too (root undefined unless `--root`); staleness
  checks every hydrated source. `hydrate-cache.mjs` drops the `root = gitRoot()` arg (gates on the current
  repo being adopted, but rebuilds all scopes).
- 2026-06-04: VERIFIED live from the HOD cwd — `hydrate-db` reports 123 items across 2 scopes; per-scope
  count `HOD 73 / KIT 50`; `next-id KIT tickets` → `KIT-T031` (was `1`); `integrity` danglingLinks `0`
  (KIT-T023 no longer dangling). Added test `db-cache.test.mjs`: two temp scopes (KIT+HOD) via the registry,
  hydrate cross-scope, assert both present + queryable. Full suite green.
</content>
</invoke>
