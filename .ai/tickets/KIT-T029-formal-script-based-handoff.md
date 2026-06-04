---
id: KIT-T029
title: Formal script-based handoff — borrow workflow's begin/end-task scripts so collation is programmatic, not orchestrator-ingested
type: feature
status: todo
priority: high
labels: [agents, handoff, scripts, tokens, workflow-borrow]
links: [KIT-T020, KIT-T018, KIT-T004, KIT-T017]
files: [scripts/, commands/]
created: 2026-06-04T16:20:00Z
updated: 2026-06-04T16:20:00Z
---

## Description
Maintainer clarified the workflow borrow: it's not just the DB SCHEMA (KIT-T004) — borrow the
SCRIPTS as a FORMAL handoff mechanism. In D:\dev\workflow: `scripts/orchestrator/begin-cycle.ts`,
`scripts/agent/begin-task.ts` / `end-task.ts`, + the assignment/comment/worklog/activity API. The
point: an agent COLLATES its context (ticket + provenance + recent activity) and RECORDS its
worklog/status PROGRAMMATICALLY via these scripts — so the orchestrator (me) INGESTS less and
COLLATES less in-context. Less ingestion + programmatic collation = token savings (the dominant
cost lever per /usage; KIT-T020).

## Acceptance Criteria
- [ ] `begin-task`-style script: given a ticket id, programmatically assembles the handoff context
      (ticket + links + governing decisions + recent worklog/activity — via the cache, KIT-T004/T026)
      so the orchestrator passes an ID, not pasted context (KIT-D018 grounding becomes programmatic).
- [ ] `end-task`-style script: an agent records status transition + timestamped worklog + comments
      (KIT-T028) programmatically on completion, instead of the orchestrator hand-editing the ticket.
- [ ] Adapted to KIT's markdown-as-truth (writes go to the markdown stores; cache re-hydrates) — NOT
      workflow's DB-as-truth/ORM.
- [ ] Wires into /drain + /work so handoffs are formal + low-ingestion by default.

## Notes
- 2026-06-04: Maintainer: "take a look at the [workflow] scripts as a formal way of handing off …
  less ingestion from you and more collating through programmatic processes, which also saves tokens."
