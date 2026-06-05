---
id: KIT-D024
title: "Cache-first data architecture — files are the write-only diffable record; the index is the sole read surface; ingest is immediate"
date: 2026-06-05
supersedes:
source: conversation 2026-06-05 (maintainer)
links: [KIT-D021, KIT-D020, KIT-T004, KIT-T012, KIT-T026, KIT-T031, KIT-T035]
---

**Decision:** One data law over two indexes (the work-item cache `q.mjs` for `.ai` stores,
the code-map `code-graph` for source):

1. **Direction is one-way: files → index.** Files (markdown `.ai` stores, source code) are
   the *diffable record of record* — write-only, for git history. Nothing reads them to
   *look something up*.
2. **The index is the only read/search surface.** Work-item lookups go through the cache
   (`q.mjs`); code-symbol lookups go through the code-map. 
3. **Ingest is immediate.** On any file change, the change is hydrated into its index right
   then — not lazily on next query. The index is never stale.
4. **`grep`/`find`/`cat` to locate or look up a managed item is a defect.** "If you're using
   grep, you're fucking up." Scoped to **claude-kit-MANAGED repos** (those with `.ai` +
   cache + code-map). A **cross-repo / unmanaged-repo** search (e.g. an engine repo not under
   KIT) is NOT this failure — it's outside the index; grep there is legitimate. If such a
   repo enters scope, it gets indexed and the rule then applies.
5. **Both indexes are cross-project** (KIT-T031) — queryable from any cwd, every scope.

**Why:** Maintainer (2026-06-05), verbatim across the session: "Files are for diffable record
keeping only." "It needs to be a principle that if you're using GREP, you're fucking up. It
should always be in the cache." "They need to be ingested IMMEDIATELY." "Changes always flow
through files -> back out to cache." "Same with code. If you can't find where something is
through the code map, it's a process failure." "Code map should never be out of sync." The
trigger: a `/clear` resume in hustle-or-die where the orchestrator (a) believed completed
agent work was "lost" by trusting a stale read instead of a live index, (b) repeatedly
`grep`/`find`-scanned `.ai` and ticket files for answers the cache already held, and (c)
hand-located write paths by guessing. Every such miss burns maintainer time/tokens and
compounds per request. This is the read/write architecture under the governing meta-rule
**KIT-D021** (automate over manual; never depend on a remembered step — encode/enforce it).

**Mechanics (the build — the workflow-automation cluster):**
- **Immediate ingest hook** — `PostToolUse(Write|Edit)` on any `.ai` store file runs
  `hydrate-db --if-stale` (targeted scope); on any source file, re-indexes the code-map.
  Replaces lazy/on-query staleness checking (KIT-T026/T035).
- **Read-enforcement guard** — flag `grep`/`find`/`cat` against a managed repo's `.ai` or
  indexed source when a `q.mjs`/code-map query exists (warn, fail-open per the hook contract).
  Does NOT flag cross-repo/unmanaged search (item 4).
- **Cross-project capture + triage** consume the cache, never scan (KIT-T006/T027).
- **Resume surfaces in-flight agents** from the cache (KIT-T014).
- **Programmatic question-raising** in lockstep (KIT-T005/T017).
