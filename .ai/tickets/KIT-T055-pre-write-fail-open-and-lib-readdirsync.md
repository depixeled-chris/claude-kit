---
id: KIT-T055
title: pre-write gets the fail-open guard its comment claims; fix lib.mjs missing readdirSync import
type: bug
status: todo
priority: high
milestone: M1-gate-integrity
labels: [hooks, gates, fail-open]
files:
  - hooks/pre-write.mjs
  - hooks/lib.mjs
links: []
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Two fail-open violations:
1. pre-write.mjs has NO top-level fail-open guard, but the comment at lines 40-41 claims
   `codeOnly` throws are "caught by the caller's fail-open guard". Today an uncaught throw
   exits 1 — non-blocking only by exit-code accident, not by design. The HOOK CONTRACT
   requires explicit fail-open.
2. lib.mjs:166 uses `readdirSync` without importing it; the ReferenceError is swallowed by
   the surrounding try, so `projectAiDirs()` silently never enumerates central-dataRoot-only
   projects — hydrate-cache and survey see a quietly smaller world.

Also audit the module-top imports from `../scripts/` in orient/commit-gate/sync-data: an
import-time error currently crashes the whole hook (same exit-1 accident).

## Acceptance Criteria
- [ ] pre-write wraps its body in an explicit try/catch that exits 0 on unexpected error (warning to stderr), matching the comment.
- [ ] `readdirSync` imported in lib.mjs; a test exercises projectAiDirs over a central dataRoot.
- [ ] orient/commit-gate/sync-data survive a missing/broken `../scripts/` import without crashing the hook (lazy import or guarded top-level).
- [ ] Regression test: a hook fed a payload that triggers an internal throw still exits 0.

## Plan
1. Guard pre-write.
2. Fix lib import + test.
3. Guard scripts/ imports.

## Notes
- 2026-06-09: opened from the full-plugin process review (hooks pipeline audit).
