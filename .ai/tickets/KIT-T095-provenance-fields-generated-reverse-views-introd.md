---
id: KIT-T095
title: Provenance fields + generated reverse views: introduced_by / produced_by / informs (KIT-T003 crit 6+7)
type: feature
status: doing
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T094]
files:
  - scripts/index-tickets.mjs
supersedes:
superseded_by:
created: 2026-06-15T14:54:02Z
updated: 2026-06-15T14:54:49Z
---

## Description
Child of [[KIT-T003]] (criteria 6 + 7) — provenance fields + GENERATED reverse views, the
same parse+rollup idiom as [[KIT-T094]] (`parent:`). Bug provenance: `introduced_by:` (the
originating ticket + commit). Document provenance: `produced_by:` (one source doc) + `informs:`
(many work items it feeds) — already used live on HOD's HOD-R### requests. The indexer GENERATES
the reverse view (a doc's downstream items; a commit's introduced bugs). claude-kit-only;
`scripts/index-tickets.mjs`; no `lib.mjs`.

**Out of scope (lib.mjs-GATED → defer to after KIT-T021):** crit 8's commit-gate cite-pattern
must add `R`/`E` to `ID_CITE_SRC` (lib.mjs:318 is `[A-Z]{2,}-[TDNQ]\d{1,4}` — R/E ids aren't
recognized by the commit-gate/lints yet, a latent gap from KIT-T092). And crit 2 (LAB scope)
needs the lib.mjs survey. Both wait for lib.mjs to free.

## Acceptance Criteria
- [ ] `introduced_by:` parsed (a `ticket@commit` or id) and rendered; the REGRESSIONS/board view reflects it alongside the existing `regression_of:`/`causing_commit:`.
- [ ] `produced_by:` (single) + `informs:` (list) parsed in frontmatter, same tolerant idiom as `aka:`/`parent:`.
- [ ] The indexer GENERATES the reverse view: under a source doc/item, the work items it `produced`/`informs`; never a hand-maintained list.
- [ ] A dangling provenance ref degrades gracefully (no board crash).
- [ ] Both `_TEMPLATE.md` files carry the new fields (empty).
- [ ] Test: produced_by/informs render the reverse rollup; introduced_by surfaces on the regressions view; dangling ref doesn't crash.

## Plan
1. Parse `introduced_by` / `produced_by` (single) + `informs` (list) in `scripts/index-tickets.mjs` (mirror the `parent:`/`aka:` parse from KIT-T094/T091).
2. Reverse-index pass: source id → downstream items; render the rollup + the upward markers.
3. Wire `introduced_by` into the REGRESSIONS view next to the existing regression fields.
4. Add the fields to both `_TEMPLATE.md`; tests; `npm test` green.
5. (DEFERRED, gated) backport-procedure STRIP of `produced_by:`/`informs:` on gift + the R/E cite-pattern — when lib.mjs frees (KIT-T021).

## History
- [2026-06-15 14:54] (created) feature — Provenance fields + generated reverse views: introduced_by / produced_by / informs (KIT-T003 crit 6+7)
- [2026-06-15 14:54] (status) todo → doing
