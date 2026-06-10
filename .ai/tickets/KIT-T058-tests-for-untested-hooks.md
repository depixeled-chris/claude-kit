---
id: KIT-T058
title: Test coverage for the four zero-test hooks (housekeeping, hydrate-cache, lint, jscpd)
type: tech-debt
status: review
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
- [x] housekeeping: nag thresholds (memory ≥7d, gaps ≥7d) and silence-when-fresh, against a temp HOME.
- [x] hydrate-cache: refresh on stale cache, no-op on fresh, fail-open on a broken registry.
- [x] lint + jscpd: skip rules (lockfiles, vendored, ext routing) and advisory-never-block behavior.
- [x] commit-gate id-integrity branch covered.
- [x] orient standing-decision scope filter covered (in-scope surfaced, out-of-scope collapsed).
- [x] All wired into `npm test`.

## Plan
1. One test file per hook, temp-dir fixtures, same harness style as exclusions.test.mjs.

## Notes
- 2026-06-09: opened from the full-plugin process review.
- 2026-06-09: implemented, 18 new assertions in scripts/test-hooks.mjs (62 total, full
  suite green). housekeeping driven through a throwaway HOME (USERPROFILE → os.homedir());
  hydrate-cache DB isolated via CLAUDE_PLUGIN_ROOT (defaultDbPath honors it — no KIT-T035
  style leakage into the real cache); lint/jscpd gap logs also sandboxed to the temp HOME;
  commit-gate duplicate-id block exercised end-to-end; orient standing filter asserted on
  the STANDING section slice (in-scope via paths-glob, global invariant, out-of-scope →
  "+1 more ... (scopes: worldgen)" pointer). sync-data already covered by KIT-T053's file.
- FINDING (new, surfaced by the orient test): `git status --porcelain` collapses a fully
  UNTRACKED directory to `dir/`, so files in a brand-new directory can never match a
  standing decision's `paths:` glob until something in the dir is tracked. Real gap in
  KIT-T046's scope filter for greenfield work — candidate fix: status with
  `--untracked-files=all` in wipSummary (with a cap). Not fixed here (out of scope).
