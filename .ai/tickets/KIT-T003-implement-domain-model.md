---
id: KIT-T003
title: Implement the workflow domain model — LAB scope, request/epic types, hierarchy + relationship graph
type: feature
status: doing
priority: high
milestone:
labels: [taxonomy, hierarchy, relationships, scopes]
links: [KIT-D012, KIT-D011, KIT-T002]
aka: []
files:
  - project-template/.ai/config.yml
  - scripts/index-tickets.mjs
  - scripts/rekey-ids.mjs
  - hooks/commit-gate.mjs
created: 2026-06-03T14:00:00Z
updated: 2026-06-17T15:39:00Z
---

## Description
Implement the model decided in [[KIT-D012]] (which builds on the id scheme [[KIT-D011]]):
scopes incl. a repo-less `LAB`, Request/Epic as first-class types, the Request→(Epic→)Ticket
hierarchy, the bug↔prior-effort provenance links, document artifact provenance, and the general
`aka:` annotation. Large — likely re-expressed as an epic with child tickets once epics exist.

## Acceptance Criteria
- [ ] **`aka:`** annotation supported in frontmatter (list of prior labels); the generated
      board renders it (`HOD-R045 · was R045`); backfilled on every item re-keyed under KIT-D011.
- [x] **`LAB` scope** — a repo-less scope under `claude-kit-data/` (no junction); the survey /
      rundown includes it with no git state (not flagged as a missing clone).
- [ ] **Request (`R`)** and **Epic (`E`)** are first-class types with their own stores
      (`requests/`, `epics/`), config taxonomy entries, and templates.
- [ ] **Re-key hustle-or-die**: the `R`-series work items are requests → move `tickets/` items
      to `requests/`, `HOD-T### → HOD-R###`, with `aka:` preserving the bare `R###`.
- [ ] **Hierarchy**: items carry one upward `parent:`; the indexer GENERATES downward views
      (a request's epics/tickets, an epic's children) — no hand-maintained child lists.
- [ ] **Bug provenance**: `introduced_by:` links both the originating ticket AND commit;
      `regression_of:` + `causing_commit:` continue to work; REGRESSIONS index reflects both.
- [ ] **Document provenance**: docs carry `produced_by:` (one) + `informs:` (many); the indexer
      generates the reverse view on work items; the backport procedure STRIPS these on gift.
- [ ] commit-gate cite pattern + config + templates updated for the new types; `npm test` covers
      the new behavior (scope discovery, hierarchy rollup, provenance back-links).

## Plan
1. Annotation (`aka`) + board rendering — smallest, unblocks the re-key backfill.
2. `LAB` repo-less scope (data layout + survey).
3. Request/Epic types + stores + config taxonomy + templates.
4. hustle-or-die re-key tickets→requests (`HOD-T### → HOD-R###`) via rekey-ids.mjs, aka backfill.
5. Hierarchy `parent:` + generated rollups in index-tickets.mjs.
6. Bug + document provenance fields + generated reverse views + backport strip.
7. Tests; version bump.

## Notes
- 2026-06-03: Captured from the design conversation. The R-series reclassification (tickets→
  requests) supersedes the first-pass `R→T` collapse — see [[KIT-D012]]. Awaiting maintainer
  "build" before executing (it includes another HOD re-key).
- 2026-06-12: PARENT EPIC. Maintainer greenlit the HOD re-key and chose "decompose + build aka:,
  re-key next." Decomposed into child tickets (the `epic` type doesn't exist yet — that's crit 3 —
  so children link up via `links:`):
  - [[KIT-T091]] — `aka:` annotation + board rendering (crit 1). **Building now** (unblocks the re-key).
  - [[KIT-T092]] — Request/Epic types + requests/epics stores + taxonomy + templates (crit 3).
  - [[KIT-T093]] — cross-repo HOD re-key (crit 4); gated on T091+T092; the "focused next unit."
  Remaining criteria still tracked here for future children: LAB scope (2), hierarchy `parent:`/rollups
  (5), bug provenance (6), document provenance + backport-strip (7), commit-gate/config/tests (8).
  T003 stays the umbrella; close it when all children land.
- 2026-06-15: SAFE CHILDREN ALL DONE. [[KIT-T091]] aka: (done), [[KIT-T092]] R/E types+stores (done),
  [[KIT-T093]] HOD R-series materialized as 11 HOD-R### Requests (done), [[KIT-T094]] hierarchy
  parent:+rollups (done), [[KIT-T095]] provenance fields introduced_by/produced_by/informs+reverse
  views (done). Criteria 1,3,4,5,6 fully satisfied; 7 satisfied minus the gift backport-strip.
  ONLY-REMAINING is lib.mjs-GATED on [[KIT-T021]] (paused session holds lib.mjs): crit 2 LAB scope
  (survey is in lib.mjs), crit 8 R/E cite-pattern (`ID_CITE_SRC` lib.mjs:318 = `[A-Z]{2,}-[TDNQ]\d{1,4}`,
  doesn't recognize R/E — latent commit-gate gap from T092), and crit 7's backport-strip. Resume
  these the moment KIT-T021 lands; then T003 closes.

## Notes
- 2026-06-17: LAB scope shipped (marker `lab:true` in config.yml + survey neutral render "lab — repo-less by design" / "lab — no repo" + `init-project --lab`); 15 new survey.test.mjs assertions green; commit 461cb17.

## History
- [2026-06-17 15:39] (status) todo → doing
- [2026-06-17 15:50] (comment) ticked: **`LAB` scope** — a repo-less scope under `claude-kit-data/` (no junction); the survey /
