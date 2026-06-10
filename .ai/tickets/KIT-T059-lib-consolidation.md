---
id: KIT-T059
title: Consolidate duplicated hook logic into lib.mjs (one glob, one ext-parser, one root-walk, one id-regex)
type: tech-debt
status: review
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
- [x] Each listed duplicate has exactly one lib.mjs owner; call sites import it.
- [x] orient's glob semantics reconciled with lib's (one dialect, documented).
- [x] Id-citation regex unified (one constant; commit-gate and request-gate agree).
- [x] Full test suite green; behavior-preserving (no gate gets looser or stricter except where the divergence WAS the bug — document any such case in Notes).

## Plan
1. Move/own in lib.mjs; sweep call sites; run suite after each move.

## Notes
- 2026-06-09: opened from the full-plugin process review.
- 2026-06-09: implemented. lib.mjs now owns: `LOCKFILES`, `fileExt()`, `ID_CITE_SRC`,
  `centralDataRoot()`, `storeRoot()`, exported `globToRegExp`, `compileSignals()` +
  `loadCaptureConfig()`. Call sites swapped in pre-write (incl. its inline VENDORED
  copy), lint, jscpd, orient, sync-data, ingest-data, commit-gate, request-gate; unused
  imports swept. Full suite green unchanged (the existing 64+ assertions ARE the
  behavior-preservation proof).
- DOCUMENTED BEHAVIOR CHANGES (divergence was the bug):
  1. `paths:` globs on standing decisions now use lib's dialect (`**` = any depth, `*` =
     one segment, case-SENSITIVE full match). The old private dialect let bare `*` cross
     `/` case-insensitively — any existing decision relying on that must say `**`.
     ACTION for triage: sweep HOD's standing decisions for single-`*` paths globs.
  2. Id citations unified to `[A-Z]{2,}-[TDNQ]\d{1,4}`: request-gate no longer accepts
     non-TDNQ type letters; commit-gate now bounds digits to 4 (ids pad to 3 — no real
     id loses).
  3. cap.mjs still has its own store-walk — left for KIT-T067 (cap routing rework) to
     adopt lib.storeRoot, since that ticket rewrites the resolution anyway.
