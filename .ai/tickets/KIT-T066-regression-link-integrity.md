---
id: KIT-T066
title: Regression-class tickets missing their links fail the id-integrity check
type: feature
status: done
priority: medium
milestone: M3-provenance
labels: [hooks, provenance, regressions]
files:
  - hooks/sync-data.mjs
  - hooks/ingest-data.mjs
links: [KIT-T065, KIT-T060]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-11T07:00:00Z
---

## Description
The regression machinery (regressed_from / causing_commit / fixed_commit →
REGRESSIONS.md chains) is config-vapor today because nothing enforces the links exist.
Apply the same enforcement philosophy as commit citations: a `type: regression` ticket
with empty `regressed_from` AND `causing_commit` gets flagged in the existing
id-integrity slot (sync-data already blocks Stop on id problems) — nag-level first,
upgradeable to block once KIT-T065 makes the links cheap to produce.

## Acceptance Criteria
- [x] Regression ticket with no provenance links surfaces a named integrity warning at Stop.
- [x] `fixed_commit` empty on a `done` regression also flagged (pairs with /done's prompt, KIT-T060).
- [x] `provenance: inferred|given` marker accepted as satisfying.
- [x] Tests for flagged/clean cases.

## Plan
1. Extend the id-integrity scan with link checks.
2. Tests.

## Notes
- 2026-06-09: opened from the lifecycle review.
- 2026-06-11: implemented findRegressionGaps in id-utils.mjs; wired into checkIds + sync-data + check-ids CLI; 11 new tests (30 id-utils / 119 test-hooks / full npm test green). [no-test: covered by id-utils.test.mjs + npm test]

## History
- [2026-06-11 06:34] (status) todo → doing
- [2026-06-11 07:00] (status) doing → done
