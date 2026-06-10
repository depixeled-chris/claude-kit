---
id: KIT-T058
title: Test coverage for the four zero-test hooks (housekeeping, hydrate-cache, lint, jscpd)
type: tech-debt
status: todo
priority: high
milestone: M1-gate-integrity
labels: [hooks, tests]
files:
  - hooks/housekeeping.mjs
  - hooks/hydrate-cache.mjs
  - hooks/lint.mjs
  - hooks/jscpd.mjs
  - scripts/test-hooks.mjs
links: [KIT-T053]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
sync-data (covered by KIT-T053), housekeeping, hydrate-cache, lint, and jscpd have ZERO
tests. The one with a confirmed bug (sync-data's false receipt) was exactly one of the
untested ones — that is not a coincidence. Also untested: commit-gate's id-integrity
branch (commit-gate.mjs:54-68) and orient's standing-decision scope filter.

## Acceptance Criteria
- [ ] housekeeping: nag thresholds (memory ≥7d, gaps ≥7d) and silence-when-fresh, against a temp HOME.
- [ ] hydrate-cache: refresh on stale cache, no-op on fresh, fail-open on a broken registry.
- [ ] lint + jscpd: skip rules (lockfiles, vendored, ext routing) and advisory-never-block behavior.
- [ ] commit-gate id-integrity branch covered.
- [ ] orient standing-decision scope filter covered (in-scope surfaced, out-of-scope collapsed).
- [ ] All wired into `npm test`.

## Plan
1. One test file per hook, temp-dir fixtures, same harness style as exclusions.test.mjs.

## Notes
- 2026-06-09: opened from the full-plugin process review.
