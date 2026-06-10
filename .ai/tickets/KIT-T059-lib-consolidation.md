---
id: KIT-T059
title: Consolidate duplicated hook logic into lib.mjs (one glob, one ext-parser, one root-walk, one id-regex)
type: tech-debt
status: todo
priority: medium
milestone: M1-gate-integrity
labels: [hooks, dry]
files:
  - hooks/lib.mjs
  - hooks/pre-write.mjs
  - hooks/lint.mjs
  - hooks/jscpd.mjs
  - hooks/orient.mjs
  - hooks/sync-data.mjs
  - hooks/ingest-data.mjs
  - hooks/request-gate.mjs
  - hooks/commit-gate.mjs
links: []
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
DRY violations across the hook suite, each a future divergence bug:
- Lockfile-skip regex duplicated (pre-write.mjs:81, lint.mjs:25).
- pre-write.mjs:80 inlines a literal copy of `lib.VENDORED` (lib.mjs:209).
- Ext extraction tripled (pre-write.mjs:97, lint.mjs:28, jscpd.mjs:24).
- dataRoot-via-realpath(.ai) duplicated (orient.mjs:122-130, sync-data.mjs:17-26).
- THREE glob implementations (lib globToRegExp, orient globToRe with different semantics, request-gate loadCapture's YAML-subset parser living outside lib).
- findRoot ancestor-walk in ingest-data.mjs:17-25 vs lib.projectRoot (different markers).
- Id-citation regex differs: commit-gate.mjs:77 `[A-Z]{2,}-[TDNQ]\d+` vs request-gate.mjs:40 `[A-Z]{2,}-[A-Z]\d{1,4}`.

## Acceptance Criteria
- [ ] Each listed duplicate has exactly one lib.mjs owner; call sites import it.
- [ ] orient's glob semantics reconciled with lib's (one dialect, documented).
- [ ] Id-citation regex unified (one constant; commit-gate and request-gate agree).
- [ ] Full test suite green; behavior-preserving (no gate gets looser or stricter except where the divergence WAS the bug — document any such case in Notes).

## Plan
1. Move/own in lib.mjs; sweep call sites; run suite after each move.

## Notes
- 2026-06-09: opened from the full-plugin process review.
