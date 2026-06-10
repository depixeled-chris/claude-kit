---
id: KIT-T000
title: <short imperative title>
type: bug              # any key from .ai/config.yml → classifications
status: todo           # todo | doing | review | done | superseded  (see config.statuses)
priority: medium       # critical | high | medium | low
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
links: []              # related tickets, commits (regressions: causing commit), URLs
files: []              # repo-root-relative paths this ticket touches
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: <YYYY-MM-DDThh:mm:ssZ>
updated: <YYYY-MM-DDThh:mm:ssZ>
---

## Description
<what and why>

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
