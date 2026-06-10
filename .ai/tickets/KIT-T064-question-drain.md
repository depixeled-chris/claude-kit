---
id: KIT-T064
title: Question drain — answer_self_questions gets a verb; questions/ stops being a dead store
type: feature
status: todo
priority: low
milestone: M2-close-the-loop
labels: [commands, lifecycle]
files:
  - commands/drain.md
  - commands/decide.md
links: []
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
`drain.answer_self_questions: true` exists in config and `/decide` batches
maintainer-pending decisions, but nothing drains `questions/` as a first-class verb —
the store has never held anything but its template. Fold question-draining into `/drain`
(answer claude-answerable ones from code/decisions and log the answer; batch chris-only
ones into the next `/decide`) rather than adding another command.

## Acceptance Criteria
- [ ] /drain processes open questions per `answerable_by`: claude → answered + logged inline; chris → queued for /decide.
- [ ] Answered questions get a recorded answer + date, not deletion.
- [ ] CLAUDE.snippet.md documents the question lifecycle.

## Plan
1. Extend drain.md prose; small scanner if needed.
2. Docs.

## Notes
- 2026-06-09: opened from the lifecycle review.
