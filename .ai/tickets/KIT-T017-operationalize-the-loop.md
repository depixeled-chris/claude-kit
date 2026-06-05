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
- [2026-06-05 20:16] (comment) folded from triage: drain should ORCHESTRATE subagents: fan independent work out to parallel subagents in the drain, coordinate them + batch the maintainer's requests so progress doesn't depend on the maintainer interrupting, and minimize token use (don't do everything inline/serially). Model on the D:/dev/workflow repo's turn-process + subagent design (consolidates 3 maintainer messages 2026-06-04)
- 2026-06-04: From the live session where the drain went idle between waves and decisions were made
  unilaterally instead of surfaced.
- 2026-06-04 SPEC: `/prime` + `/drain` are the PRIMARY command path — "everything, for the most part."
  The maintainer mostly runs /prime (resume: orient + SESSION + TaskList reattach) then /drain.
  /drain KICKS OFF the loop (it's the entry point); the loop then runs CONTINUOUSLY — no other
  commands needed — until the maintainer stops it or a genuine decision is required:
  - TAKE FEEDBACK: capture each maintainer interjection as its own item (no conflation), route it, continue.
  - PRESENT QUESTIONNAIRES: batch genuine maintainer-only decisions to AskUserQuestion ("(Recommended)"
    front-of-label), never prose.
  - TASK SUBAGENTS WITH MINIMAL DIRECTION: hand a subagent a ticket id + scoped pointers, NOT a big
    authored prompt — the ticket carries provenance (KIT-D018), project knowledge-agents (KIT-T015)
    hold the domain + guards, so the per-task direction is the delta only. Cuts tokens (KIT-T020).
  - NEVER IDLE + ALERT ON LANDING (KIT-T021) throughout.
  - NEVER HOLD SILENTLY: if the loop is waiting on maintainer feedback/a decision, PRESENT THE
    QUESTIONNAIRE IMMEDIATELY (don't sit idle saying "holding") — surfacing the decision IS the
    non-idle action when work is gated on the maintainer.
  - ONE BLOCKED THREAD ≠ IDLE: a single item gated on the maintainer (or a Q&A) does NOT license
    the whole drain to stall. Keep the OTHER unblocked threads (other tickets, other projects)
    draining in parallel while that one waits. (Recurring failure: single-threading on a conversation
    while the rest of the queue sat idle.)
