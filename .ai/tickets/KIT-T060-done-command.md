---
id: KIT-T060
title: "/done command — the human flip's mechanical tail (History line, archive move, index regen)"
type: feature
status: todo
priority: high
milestone: M2-close-the-loop
labels: [commands, lifecycle]
files:
  - commands/done.md
  - scripts/index-tickets.mjs
links: [KIT-T061, KIT-T062]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
`done` is human-only by design, but the tail it triggers is all mechanical and currently
all manual — which is why it never happens: 23 tickets are parked in `review`, ZERO
tickets have ever reached `done`, and `tickets/archive/` (configured via
`history.archive_done_to`) does not exist. The pipeline only fills.

`/done KIT-T0xx` (run by Chris) should: set `status: done`, append the History/Notes
line, set `fixed_commit` on bug tickets (prompting if unknown), move the file to
`tickets/archive/`, and regenerate INDEX.md. Batch form `/done KIT-T001 KIT-T002 ...`
for clearing a review backlog.

## Acceptance Criteria
- [ ] `/done <id...>` performs flip + history + archive move + index regen in one step.
- [ ] Bug/regression tickets prompt for `fixed_commit` if frontmatter is empty (link integrity — feeds REGRESSIONS.md).
- [ ] Refuses politely when the ticket is not in `review`.
- [ ] A `/done`-less manual flip is still detected: index regen (KIT-T063) picks it up.
- [ ] Documented in README command list + CLAUDE.snippet.md lifecycle section.

## Plan
1. commands/done.md skill prose + a small script for the mechanical tail.
2. Wire fixed_commit prompt.
3. Docs.

## Notes
- 2026-06-09: opened from the lifecycle review — closure is the system's weakest stage.
