---
id: KIT-T091
title: aka: prior-label annotation + board rendering (KIT-T003 child)
type: feature
status: done
priority: medium
milestone:
labels: []
links: [KIT-T003]
files:
  - scripts/index-tickets.mjs
  - scripts/rekey-ids.mjs
supersedes:
superseded_by:
created: 2026-06-12T19:52:28Z
updated: 2026-06-12T20:01:09Z
---

## Description
Child of [[KIT-T003]] (criterion 1) — the standalone foundation that unblocks the
HOD re-key ([[KIT-T093]]). A general `aka:` frontmatter annotation (list of prior
labels/ids an item was known by) so a re-keyed item stays discoverable under its old
id, and the generated board renders the alias. claude-kit-only; no HOD touch; no lib.mjs.

## Acceptance Criteria
- [x] `aka:` (a list) is supported in item frontmatter and parsed by the board/index pipeline.
- [x] The generated board (INDEX.md) renders the alias, e.g. `HOD-R045 · was R045`.
- [x] `scripts/rekey-ids.mjs` backfills `aka:` with the prior id when it re-keys an item (so T093's re-key inherits the alias automatically).
- [x] Both ticket templates (`_TEMPLATE.md`, project-template) carry the `aka:` field (empty list).
- [x] Test covers: an item with `aka:` renders the alias on the board; rekey-ids adds `aka:`.

## Plan
1. Parse `aka:` in the frontmatter reader used by `scripts/index-tickets.mjs` (tolerant list parse, same idiom as `labels:`).
2. Render the alias in the generated board row.
3. `scripts/rekey-ids.mjs`: on re-key, push the old id into the item's `aka:` list.
4. Add `aka: []` to both `_TEMPLATE.md` files.
5. Tests + `npm test` green.

## Notes
Frontmatter reader lives in `scripts/index-tickets.mjs` (NOT lib.mjs — confirmed). Added `listField()` helper (same tolerant inline-list idiom as `db-parse.mjs:list()`). Board alias format: `· was <id>` appended to the title cell, joined by comma for multiple aliases. rekey-ids: `pushAka()` must run AFTER the ref-rewrite pass, not before — the global ref-sweep would overwrite `aka: [R045]` with `aka: [HOD-T045]` otherwise (caught + fixed in the test run). New tests: `scripts/index-tickets.test.mjs` (6 cases) + `scripts/rekey-ids.test.mjs` (6 cases). `npm test`: 0 failures across full suite.

## History
- [2026-06-12 19:52] (created) feature — aka: prior-label annotation + board rendering (KIT-T003 child)
- [2026-06-12 19:54] (status) todo → doing
- [2026-06-12 20:00] (comment) ticked: `aka:` (a list) is supported in item frontmatter and parsed by the board/index pipeline.
- [2026-06-12 20:00] (comment) ticked: The generated board (INDEX.md) renders the alias, e.g. `HOD-R045 · was R045`.
- [2026-06-12 20:00] (comment) ticked: `scripts/rekey-ids.mjs` backfills `aka:` with the prior id when it re-keys an item (so T093's re-key inherits the alias automatically).
- [2026-06-12 20:00] (comment) ticked: Both ticket templates (`_TEMPLATE.md`, project-template) carry the `aka:` field (empty list).
- [2026-06-12 20:00] (comment) ticked: Test covers: an item with `aka:` renders the alias on the board; rekey-ids adds `aka:`.
- [2026-06-12 20:01] (status) doing → review
- [2026-06-12 20:01] (status) review → done
