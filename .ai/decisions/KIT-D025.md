---
id: KIT-D025
title: "Cache sync is ONE holistic script (stat-manifest scan → incremental diff) — defer granular invalidation until measured perf demands it"
date: 2026-06-05
supersedes:
source: conversation 2026-06-05 (maintainer)
links: [KIT-D024, KIT-T026, KIT-T035]
---

**Decision:** The cache stays a **single holistic sync**: when it runs, it stats EVERY tracked
store file (the global "temperature"), diffs against a `source_files` manifest, and
**incrementally** upserts only the changed files' rows / deletes removed ones / leaves
unchanged rows untouched. Explicitly NOT:
- **not** drop-and-rebuild (unchanged rows persist),
- **not** per-single-file atomic ("a file changed, run a targeted update against just it"),
- **not** brute force (unchanged files are never read or parsed).

Change-detection is **mtime+size** (stat-only). Do NOT add a content-hash confirm, per-store
incremental invalidation, or any finer-grained scheme **until measured performance demands it.**

**Why:** Maintainer (2026-06-05), verbatim: "If we run into performance issues, we'll
reconsider the one-script-to-rule-them-all, but for now, it seems cheap enough." At the current
corpus (~160 small markdown items) a full stat sweep + parse-only-dirty is sub-100ms. mtime+size
never MISSES a real change — every edit/pull/checkout bumps mtime, and the immediate-ingest hook
fires on the Write that does it — so the only cost of skipping the hash is an occasional
re-parse of content-identical files after a branch-switch, which is negligible at this scale.
A content hash would trade that negligible waste for reading every file every sweep — the wrong
side of the tradeoff until the corpus is large enough to measure. YAGNI under KIT-D021.

**Mechanics:** Implemented in KIT-T026 (claude-kit `d2edd95`): `hydrate()` is the sync;
`source_files(relpath,scope,mtime,size)` manifest; `hooks/ingest-data.mjs` (PostToolUse) runs
the scoped sync immediately on any `.ai` Write/Edit. Revisit trigger: a measured, not imagined,
sync-time regression.
