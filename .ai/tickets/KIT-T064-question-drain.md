---
id: KIT-T064
title: Question drain — answer_self_questions gets a verb; questions/ stops being a dead store
type: feature
status: review
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
updated: 2026-06-10T21:27:06Z
---

## Description
`drain.answer_self_questions: true` exists in config and `/decide` batches
maintainer-pending decisions, but nothing drains `questions/` as a first-class verb —
the store has never held anything but its template. Fold question-draining into `/drain`
(answer claude-answerable ones from code/decisions and log the answer; batch chris-only
ones into the next `/decide`) rather than adding another command.

## Acceptance Criteria
- [x] /drain processes open questions per `answerable_by`: claude → answered + logged inline; chris → queued for /decide.
- [x] Answered questions get a recorded answer + date, not deletion.
- [x] CLAUDE.snippet.md documents the question lifecycle.

## Plan
1. Extend drain.md prose; small scanner if needed.
2. Docs.

## Notes
- 2026-06-09: opened from the lifecycle review.
- 2026-06-10: question-draining folded into `/drain` (new step 5) — `answerable_by: claude` resolved
  inline (answer + date into `**Resolution:**`, status→resolved, NEVER deleted), `answerable_by: chris`
  batched into the next `/decide`. Lifecycle documented in `project-template/CLAUDE.snippet.md`;
  `commands/decide.md` cross-references the drain→decide handoff. [no-test: docs-only — command prose
  + project-template snippet, no executable change.]

## History
- [2026-06-10 21:23] (status) todo → doing
- [2026-06-10 21:25] (comment) ticked: /drain processes open questions per `answerable_by`: claude → answered + logged inline; chris → queued for /decide.
- [2026-06-10 21:25] (comment) ticked: CLAUDE.snippet.md documents the question lifecycle.
- [2026-06-10 21:26] (comment) ticked: Answered questions get a recorded answer + date, not deletion.
- [2026-06-10 21:27] (status) doing → review
