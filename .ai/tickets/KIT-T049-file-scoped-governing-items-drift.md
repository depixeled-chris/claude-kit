---
id: KIT-T049
title: File-scoped governing-item surfacing + decided-vs-actual structural drift check
type: feature
status: review
priority: high
milestone:
labels: [process, provenance, hooks]
links: [KIT-T048, KIT-D028]
files: [scripts/q.mjs, scripts/db-parse.mjs, hooks/orient.mjs]
supersedes:
superseded_by:
created: 2026-06-06T16:00:00Z
updated: 2026-06-06T16:00:00Z
---

## Description
Close the enforcement gap where a captured ticket/decision that GOVERNS some files stays
invisible while those files are worked. KIT-T048/[[KIT-D028]] solved ANCESTRY (walk an
item's parents — `q trail`); this solves the OTHER direction: "what OPEN tickets/decisions
govern the files I'm touching right now," plus a decided-vs-actual structural drift check.

Motivating failure (dogfood against it): HOD-T048 ("Host = viewer + config; retire
TS-as-truth") sat `todo` while the agent repeatedly built in src/world, src/sim,
src/vehicles — the EXACT files it governs — and nothing surfaced it. Same class as HOD-D003
not surfacing while HOD-T106 was worked.

## Acceptance Criteria
- [x] `q governing <path...>` — given file path(s), returns OPEN tickets + in-force decisions
  that govern them, matching paths against tickets' `files:` and decisions' `scope`/`paths`;
  DECISIONS first, token-frugal clipped-gist + `✎` drill-in, glob-ish matching.
- [x] Reuses the cache (SQLite) with the markdown-scan fallback; fail-open (governing/drift are
  scan-only by nature — the fields aren't in the SQLite schema — so cached:false, never wedge).
- [x] `db-parse` exposes decision `scope`/`paths` on the row model (as `govScope`/`paths`,
  avoiding the id-prefix `scope` clash; reuses orient's parsing intent).
- [x] orient surfaces, for the working tree's currently-changed files, the OPEN governing
  tickets/decisions under a clear header ("GOVERNS what you're touching"), deduped vs standing
  decisions, fail-open. (Also fixed a latent porcelain-path parse bug — slice(3) → regex.)
- [x] `q drift` — flags OPEN tickets/in-force decisions whose `files:` name a concrete target
  path ABSENT from the repo, AND an unrealized "retire X as truth / keep frozen as example"
  separation when no legacy/frozen area exists.
- [x] HOD-T048 + HOD-D003 light up in drift (no legacy/frozen separation exists). Read-only on HOD.
- [x] Tests (db-cache.test.mjs, +8): file path → governing open items; glob path matching;
  decisions-first; drift on absent declared target + unrealized separation; comment-stripping;
  fail-open with no cache; db-parse scope/paths exposure.

## Plan
1. db-parse: parse decision `scope`/`paths` into the row model.
2. q.mjs: `governing` + `drift` verbs (cache + markdown fallback, shared matcher).
3. orient: surface governing items for changed files.
4. Tests mirroring the q.mjs/orient style.

## Notes
- 2026-06-06: opened, inception-out to KIT-T048/[[KIT-D028]] (the trail work). Fixes the
  HOD-T048-didn't-surface + HOD-D003/T106 class.
- 2026-06-06: shipped + dogfooded on HOD. `q governing src/world/City.ts` surfaces HOD-D015
  (paths src/world/*); `q governing src/sim/Sim.ts src/main.ts` surfaces HOD-T048 (files
  src/sim, src/main.ts). `q drift` flags exactly HOD-T048 + HOD-D003 (retire-TS-as-truth with
  no legacy/frozen area on disk) — zero noise after tightening the separation heuristic to a
  verb-near-source-of-truth proximity match. Also caught a real parser gap: `files: [] # comment`
  parsed the comment as a bogus target — fixed with a bracket/quote-aware stripComment in
  db-parse (benefits scalar/list/csv). orient end-to-end: the GOVERNS section fires for changed
  files and surfaced KIT-T049 itself governing the files being edited (self-dogfood).
- 2026-06-06: maintainer directive (→ HOD inbox): legacy TS stays buildable from a different
  path; `/legacy` is fine — confirms the drift heuristic; the flag clears once the area lands.
- npm test: green (db-cache 58→66; full suite passes, baseline 162 intact).
