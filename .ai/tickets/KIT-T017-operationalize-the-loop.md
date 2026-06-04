---
id: KIT-T017
title: Operationalize the always-on loop (D017) — drain-never-idle + questionnaire-surfacing discipline
type: feature
status: todo
priority: high
milestone:
labels: [drain, orchestration, contract, hooks]
links: [KIT-D017, KIT-D015]
files: [commands/drain.md, commands/work.md, hooks/flush.mjs]
created: 2026-06-04T12:00:00Z
updated: 2026-06-04T12:00:00Z
---

## Description
Make KIT-D017's loop structural, not vibes. Encode in the drain/work contract: (1) DRAIN NEVER
IDLES — when a wave of delegated agents finishes, the next captured/triaged items are dispatched
immediately; the orchestrator must not sit between waves doing only bookkeeping. (2) QUESTIONNAIRE
DISCIPLINE — genuine maintainer-only decisions are batched to AskUserQuestion (recommended option
first, "(Recommended)" at the FRONT of the label), never buried in prose.

## Acceptance Criteria
- [ ] drain/work contract docs state the never-idle redispatch rule + the questionnaire rule.
- [ ] A Stop-time signal (soft) when the drain has captured-but-undispatched items and no agents running.
- [ ] No existing hook weakened.

## Plan
1.

## Notes
- 2026-06-04: From the live session where the drain went idle between waves and decisions were made
  unilaterally instead of surfaced.
