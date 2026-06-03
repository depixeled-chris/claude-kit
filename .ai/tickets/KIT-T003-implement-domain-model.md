---
id: KIT-T003
title: Implement the workflow domain model — LAB scope, request/epic types, hierarchy + relationship graph
type: feature
status: todo
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
updated: 2026-06-03T14:00:00Z
---

## Description
Implement the model decided in [[KIT-D012]] (which builds on the id scheme [[KIT-D011]]):
scopes incl. a repo-less `LAB`, Request/Epic as first-class types, the Request→(Epic→)Ticket
hierarchy, the bug↔prior-effort provenance links, document artifact provenance, and the general
`aka:` annotation. Large — likely re-expressed as an epic with child tickets once epics exist.

## Acceptance Criteria
- [ ] **`aka:`** annotation supported in frontmatter (list of prior labels); the generated
      board renders it (`HOD-R045 · was R045`); backfilled on every item re-keyed under KIT-D011.
- [ ] **`LAB` scope** — a repo-less scope under `claude-kit-data/` (no junction); the survey /
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
