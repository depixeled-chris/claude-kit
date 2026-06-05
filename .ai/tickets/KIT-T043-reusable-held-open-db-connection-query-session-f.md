---
id: KIT-T043
title: reusable held-open DB connection / query-session for multi-query callers (open once, run N searches on one handle) -- amortizes the ~80ms q.mjs process+open startup. triage.mjs holds one handle inline now; generalize later as a q.mjs batch/session mode or a withDb(fn) helper that exports the canned queries against a shared handle. Per KIT-D025 defer any daemon until measured -- this is the cheap in-process form
type: feature
status: superseded
priority: medium
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
links: []
files: []              # repo-root-relative paths this ticket touches
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-06-05T20:16:00.331Z
updated: 2026-06-05T20:16:00.331Z
---

## Description
reusable held-open DB connection / query-session for multi-query callers (open once, run N searches on one handle) -- amortizes the ~80ms q.mjs process+open startup. triage.mjs holds one handle inline now; generalize later as a q.mjs batch/session mode or a withDb(fn) helper that exports the canned queries against a shared handle. Per KIT-D025 defer any daemon until measured -- this is the cheap in-process form

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
