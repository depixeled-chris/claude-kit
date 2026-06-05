---
id: KIT-T039
title: GUARD: subagents must NOT modify LEGACY/being-ported code (e.g. HOD's TS sim/world-gen migrating to the Rust core). Make the no-touch boundary explicit in every agent handoff/prompt, and ideally a hook/check that flags edits to paths marked legacy. Critical: agents fixing bugs must target the live layer, not churn code that's being retired
type: feature
status: superseded
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
links: []
files: []              # repo-root-relative paths this ticket touches
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-06-05T20:16:00.321Z
updated: 2026-06-05T20:16:00.321Z
---

## Description
GUARD: subagents must NOT modify LEGACY/being-ported code (e.g. HOD's TS sim/world-gen migrating to the Rust core). Make the no-touch boundary explicit in every agent handoff/prompt, and ideally a hook/check that flags edits to paths marked legacy. Critical: agents fixing bugs must target the live layer, not churn code that's being retired

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
