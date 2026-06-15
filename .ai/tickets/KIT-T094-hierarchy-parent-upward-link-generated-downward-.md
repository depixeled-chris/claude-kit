---
id: KIT-T094
title: Hierarchy: parent: upward link + generated downward rollups (KIT-T003 child, crit 5)
type: feature
status: doing
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T091, KIT-T092]
files:
  - scripts/index-tickets.mjs
supersedes:
superseded_by:
created: 2026-06-15T14:45:21Z
updated: 2026-06-15T14:45:57Z
---

## Description
Child of [[KIT-T003]] (criterion 5). Items carry ONE upward `parent:` link; the indexer
GENERATES the downward views (a request's tickets, an epic's children) — no hand-maintained
child lists. The MECHANISM (parent field + rollup rendering), in claude-kit; populating HOD's
parent links is separate data work. Builds on [[KIT-T091]] (aka:) + [[KIT-T092]] (R/E types).
claude-kit-only; `scripts/index-tickets.mjs`; no `lib.mjs`.

## Acceptance Criteria
- [ ] `parent:` (a single id) is supported in item frontmatter and parsed by the board/index pipeline.
- [ ] The generated board GENERATES the downward rollup for a parent item — its children listed under it (e.g. a request shows its implementing tickets) — derived, never hand-maintained.
- [ ] A child renders its `parent:` (e.g. `↳ HOD-R067`) so the upward link is visible.
- [ ] A dangling `parent:` (target missing) degrades gracefully — no crash; flagged in `q integrity` if that's cheap.
- [ ] Both `_TEMPLATE.md` files carry the `parent:` field (empty).
- [ ] Test: a parent with two children renders the rollup; a child renders its parent; a dangling parent doesn't crash the board.

## Plan
1. Parse `parent:` in the frontmatter reader (`scripts/index-tickets.mjs`, same tolerant idiom as `aka:`/`labels:`).
2. Build the reverse index (parent → children) in one pass; render the downward rollup under each parent on the board + the upward marker on each child.
3. Add `parent:` to both `_TEMPLATE.md` files.
4. Tests + `npm test` green.

## History
- [2026-06-15 14:45] (created) feature — Hierarchy: parent: upward link + generated downward rollups (KIT-T003 child, crit 5)
- [2026-06-15 14:45] (status) todo → doing
