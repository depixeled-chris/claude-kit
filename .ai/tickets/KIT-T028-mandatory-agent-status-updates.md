---
id: KIT-T028
title: Mandatory ticket status updates for agents + a stale-status detector
type: feature
status: todo
priority: high
labels: [tickets, status, agents, enforcement, handoff]
links: [KIT-T018, KIT-T017, KIT-D018]
files: [commands/work.md, commands/drain.md, agents/, hooks/]
created: 2026-06-04T16:05:00Z
updated: 2026-06-04T16:05:00Z
---

## Description
Tickets drift to stale status because updating status is not enforced — some agents set it, some
don't (e.g. a killed/reverted agent left its ticket `doing`; landed work left `todo`). Maintainer:
"Status updates need to be mandatory for agents."

Make status currency structural:
- **Handoff requirement**: every delegated agent MUST set the ticket `status` as part of its work —
  `doing` when it starts, `review` when done (cargo/test-verified), back to `todo` if it bails /
  is reverted. Bake this into the agent-handoff template (KIT-T018) and the /work + /drain contracts.
- **Stale-status detector**: a check/hook that flags tickets whose status contradicts reality —
  `doing` with no recent activity, `review` with no diff, a ticket cited by a merged commit still
  `todo`, or a ticket whose dispatched agent was killed. Surfaces for reconciliation.
- The orchestrator reconciles status on every landing (already its duty per the plan-of-record rule);
  this enforces it for SUBAGENTS too.
- **TIMESTAMPED WORK LOGS + COMMENTS (mandatory)**: every ticket carries an append-only work log —
  each status transition and each meaningful step gets a TIMESTAMPED entry (who/agent, what, when) +
  free-text comments. Not having timestamped status/worklog history is unacceptable (maintainer). This
  is workflow's worklog/activity/comment model (D:\dev\workflow worklog.service / comments.service /
  activity.service) — BORROW it (already the KIT-T004 `history(item_id, ts, event, detail)` table).
  A `## Worklog` (or history) section on the ticket is the markdown serialization; the cache indexes it.

## Acceptance Criteria
- [ ] Agent-handoff template + /work + /drain mandate the status transitions (start→doing, done→review, bail→todo).
- [ ] A stale-status detector surfaces contradictions (and could gate Stop, like the request ratchet).
- [ ] No existing hook weakened.

## Notes
- 2026-06-04: Maintainer flagged old tickets with un-updated status as a process failure + made
  status updates mandatory for agents.
