---
id: KIT-T063
title: INDEX.md (and SUPERSEDED/REGRESSIONS indexes) regenerate via hook, not memory
type: feature
status: todo
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
updated: 2026-06-10T03:10:00Z
---

## Description
tickets/INDEX.md is stale vs frontmatter truth: missing T044-T051 entirely (including
the only `doing` ticket) and showing T032 as `todo` while the file says `review` —
because `scripts/index-tickets.mjs` only runs when someone remembers. Generated
reference files that depend on memory rot by design. Regenerate them in the PostToolUse
ingest path whenever a ticket file under `tickets/` is written (debounced, fail-open),
covering INDEX.md, SUPERSEDED.md, and REGRESSIONS.md.

## Acceptance Criteria
- [ ] Editing any ticket frontmatter regenerates the indexes same-turn (or marks them dirty and the Stop hook regenerates once).
- [ ] T039-T043 placeholder-text rows in INDEX/SUPERSEDED are fixed as a side effect (supersede fields filled from frontmatter).
- [ ] Fail-open: a malformed ticket file degrades to a warning, never blocks the write.
- [ ] Test: write a ticket status change in a temp store → index reflects it.

## Plan
1. Hook the existing index-tickets.mjs into ingest-data's post-write path.
2. Debounce per turn.
3. Fix placeholder rows; test.

## Notes
- 2026-06-09: opened from the lifecycle review.
