---
id: KIT-T063
title: INDEX.md (and SUPERSEDED/REGRESSIONS indexes) regenerate via hook, not memory
type: feature
status: doing
priority: medium
milestone: M2-close-the-loop
labels: [hooks, lifecycle]
files:
  - hooks/ingest-data.mjs
  - scripts/index-tickets.mjs
links: [KIT-T060]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T21:11:30Z
---

## Description
tickets/INDEX.md is stale vs frontmatter truth: missing T044-T051 entirely (including
the only `doing` ticket) and showing T032 as `todo` while the file says `review` —
because `scripts/index-tickets.mjs` only runs when someone remembers. Generated
reference files that depend on memory rot by design. Regenerate them in the PostToolUse
ingest path whenever a ticket file under `tickets/` is written (debounced, fail-open),
covering INDEX.md, SUPERSEDED.md, and REGRESSIONS.md.

## Acceptance Criteria
- [x] Editing any ticket frontmatter regenerates the indexes same-turn (or marks them dirty and the Stop hook regenerates once).
- [x] T039-T043 placeholder-text rows in INDEX/SUPERSEDED are fixed as a side effect (supersede fields filled from frontmatter).
- [x] Fail-open: a malformed ticket file degrades to a warning, never blocks the write.
- [x] Test: write a ticket status change in a temp store → index reflects it.

## Plan
1. Hook the existing index-tickets.mjs into ingest-data's post-write path.
2. Debounce per turn.
3. Fix placeholder rows; test.

## Notes
- 2026-06-09: opened from the lifecycle review.
- 2026-06-10: shipped. `scripts/index-tickets.mjs` now exports `regenerateIndexes(root)` (CLI
  guarded behind an `import.meta` main check). `hooks/ingest-data.mjs` (PostToolUse) calls it
  in its own try/catch when a hand-edit lands a `tickets/` file — same-turn, debounced via the
  KIT-T062 turn state (`INDEX_REGEN_DEBOUNCE_MS`, leading-edge: a burst of ticket writes in one
  turn regenerates once), fail-open (a malformed ticket warns to stderr, exit 0, never blocks).
  Non-ticket writes (inbox/notes/decisions) never trigger regen. Criterion 2: `field()` now
  strips the YAML inline comment, so a blank `superseded_by:` template line reads as EMPTY — the
  T039-T044 "superseded by" cells now render `—` instead of the leaked placeholder comment.
  Tests: 5 new cases in `hooks/ingest-data.test.mjs` (regen-on-edit, status-change reflected,
  placeholder→em-dash, debounce-collapses-burst, malformed-fails-open). `node scripts/test-hooks.mjs`
  101 passed / 0 failed; `node hooks/ingest-data.test.mjs` 10 passed / 0 failed; full `npm test` green.

## History
- [2026-06-10 21:11] (status) todo → doing
- [2026-06-10 21:20] (comment) ticked: Editing any ticket frontmatter regenerates the indexes same-turn (or marks them dirty and the Stop hook regenerates once).
- [2026-06-10 21:20] (comment) ticked: Fail-open: a malformed ticket file degrades to a warning, never blocks the write.
- [2026-06-10 21:20] (comment) ticked: T039-T043 placeholder-text rows in INDEX/SUPERSEDED are fixed as a side effect (supersede fields filled from frontmatter).
- [2026-06-10 21:20] (comment) ticked: Test: write a ticket status change in a temp store → index reflects it.
