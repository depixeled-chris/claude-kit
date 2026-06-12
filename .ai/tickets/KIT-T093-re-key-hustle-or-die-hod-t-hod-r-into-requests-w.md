---
id: KIT-T093
title: Re-key hustle-or-die HOD-T###->HOD-R### into requests/ with aka: backfill (KIT-T003 child, cross-repo)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T091, KIT-T092]
files: []
supersedes:
superseded_by:
created: 2026-06-12T19:52:29Z
updated: 2026-06-12T19:52:29Z
---

## Description
Child of [[KIT-T003]] (criterion 4) — make hustle-or-die's `R`-series first-class Requests.
**RE-SCOPED 2026-06-12 after grounding in HOD (see Notes): the original "rename HOD-T### →
HOD-R### tickets" premise is WRONG.** The R-series is HOD's RESEARCH TREE (`docs/research/`,
each doc carries an `R###` ROADMAP id; index = `docs/research/README.md`), NOT a subset of the
128 `HOD-T###` implementation tickets. Early R### number-share with the ticket they spawned
(R005↔HOD-T005, R030↔HOD-T030, R037↔HOD-T037…) because each research item bred a same-numbered
ticket; commit `222ef3d` partially collapsed doc-refs `R### → HOD-T###`. Renaming the
implementation tickets would corrupt the product backlog. Gated on [[KIT-T091]] (aka:) +
[[KIT-T092]] (R type + requests/ store) — both DONE.

## Acceptance Criteria
- [ ] Materialize the un-ticketed research-tree R-series as first-class `HOD-R###` Request items
      in HOD's new `.ai/requests/` store (ADDITIVE — do NOT rename implementation tickets):
      R042, R050, R052, R055, R056, R057, R058, R059, R066 + already-prefixed HOD-R062, HOD-R067.
- [ ] Each Request: title/status from its `docs/research/<doc>.md`, `aka: [R###]`, `produced_by:`
      the research doc, `links:` the implementing `HOD-T###` ticket(s) per the README index.
- [ ] HOD `.ai/requests/` store + `request` classification exist in HOD config; board/cache regen; `q` resolves new + aka ids.
- [ ] No `HOD-T###` implementation ticket is renamed. The research-LED early tickets (R005↔T005 etc.) stay as tickets; the hierarchy link (T003 crit 5) connects them upward later.
- [ ] Its own coordinated commit on HOD `main` (HOD is currently on `roads-wip` — do NOT flip the branch in place; land this when HOD is on main).

## Plan
1. PREREQ done: T091 (aka:) + T092 (R type + requests/ store).
2. From `docs/research/README.md`, take each bare-`R###` / `HOD-R###` research item (the un-ticketed set above) and author a `HOD-R###` Request file in HOD `.ai/requests/`.
3. HOD config: add `request` classification + ensure id-utils mints `HOD-R###`.
4. Verify: board/cache regen, `q` resolution, dangling-ref grep; commit on HOD main.

## Notes
- 2026-06-12 (investigation, "figure it out yourself"): Grounded in HOD git + `docs/research/README.md`.
  Evidence the R-series = research tree, not tickets: live commits `HOD-R058 P0: road solver`,
  `HOD-R060 generative humanoid`, `HOD-R062 euphoria ragdoll`, `HOD-R067 wgpu` — all born from
  research docs ("research doc proposes HOD-R0##"). `222ef3d "Re-key doc references (R### →
  HOD-T###)"` is the "first-pass collapse" KIT-D012 supersedes. README maps each research doc to
  its `R###`/`HOD-T###` ROADMAP id. So the corrected re-key is ADDITIVE materialization of the
  research tree into `requests/`, NOT a ticket rename. Held from auto-execution: HOD is on
  `roads-wip` (shelved), and per the shared-checkout rule we don't flip the branch — this lands
  as its own unit when HOD is on main.

## History
- [2026-06-12 19:52] (created) feature — Re-key hustle-or-die HOD-T###->HOD-R### into requests/ with aka: backfill (KIT-T003 child, cross-repo)
