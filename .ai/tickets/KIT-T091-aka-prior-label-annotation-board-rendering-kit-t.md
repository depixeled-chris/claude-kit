---
id: KIT-T091
title: aka: prior-label annotation + board rendering (KIT-T003 child)
type: feature
status: todo
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
updated: 2026-06-12T19:52:28Z
---

## Description
Child of [[KIT-T003]] (criterion 1) — the standalone foundation that unblocks the
HOD re-key ([[KIT-T093]]). A general `aka:` frontmatter annotation (list of prior
labels/ids an item was known by) so a re-keyed item stays discoverable under its old
id, and the generated board renders the alias. claude-kit-only; no HOD touch; no lib.mjs.

## Acceptance Criteria
- [ ] `aka:` (a list) is supported in item frontmatter and parsed by the board/index pipeline.
- [ ] The generated board (INDEX.md) renders the alias, e.g. `HOD-R045 · was R045`.
- [ ] `scripts/rekey-ids.mjs` backfills `aka:` with the prior id when it re-keys an item (so T093's re-key inherits the alias automatically).
- [ ] Both ticket templates (`_TEMPLATE.md`, project-template) carry the `aka:` field (empty list).
- [ ] Test covers: an item with `aka:` renders the alias on the board; rekey-ids adds `aka:`.

## Plan
1. Parse `aka:` in the frontmatter reader used by `scripts/index-tickets.mjs` (tolerant list parse, same idiom as `labels:`).
2. Render the alias in the generated board row.
3. `scripts/rekey-ids.mjs`: on re-key, push the old id into the item's `aka:` list.
4. Add `aka: []` to both `_TEMPLATE.md` files.
5. Tests + `npm test` green.

## History
- [2026-06-12 19:52] (created) feature — aka: prior-label annotation + board rendering (KIT-T003 child)
