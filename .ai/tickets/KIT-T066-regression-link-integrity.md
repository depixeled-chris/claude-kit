---
id: KIT-T066
title: Regression-class tickets missing their links fail the id-integrity check
type: feature
status: todo
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
updated: 2026-06-10T03:10:00Z
---

## Description
The regression machinery (regressed_from / causing_commit / fixed_commit →
REGRESSIONS.md chains) is config-vapor today because nothing enforces the links exist.
Apply the same enforcement philosophy as commit citations: a `type: regression` ticket
with empty `regressed_from` AND `causing_commit` gets flagged in the existing
id-integrity slot (sync-data already blocks Stop on id problems) — nag-level first,
upgradeable to block once KIT-T065 makes the links cheap to produce.

## Acceptance Criteria
- [ ] Regression ticket with no provenance links surfaces a named integrity warning at Stop.
- [ ] `fixed_commit` empty on a `done` regression also flagged (pairs with /done's prompt, KIT-T060).
- [ ] `provenance: inferred|given` marker accepted as satisfying.
- [ ] Tests for flagged/clean cases.

## Plan
1. Extend the id-integrity scan with link checks.
2. Tests.

## Notes
- 2026-06-09: opened from the lifecycle review.
