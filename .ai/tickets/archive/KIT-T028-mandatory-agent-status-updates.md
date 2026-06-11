---
id: KIT-T028
title: Mandatory ticket status updates for agents + a stale-status detector
type: feature
status: done
priority: high
labels: [tickets, status, agents, enforcement, handoff]
links: [KIT-T018, KIT-T017, KIT-D018]
files: [commands/work.md, commands/drain.md, agents/, hooks/]
created: 2026-06-04T16:05:00Z
updated: 2026-06-11T06:22:07Z
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
- [x] Agent-handoff template + /work + /drain mandate the status transitions (start→doing, done→review, bail→todo).
- [x] A stale-status detector surfaces contradictions (and could gate Stop, like the request ratchet).
- [x] No existing hook weakened.

## Notes
- [2026-06-05 20:16] (comment) folded from triage: Agent-assignment attribution on ticket history (who/which-agent did what) — DEFERRED per maintainer 2026-06-02; not needed yet. Prior art: workflow repo `agent_assignments`. If multi-agent accountability becomes real, add an actor field to History events (not a table).
- 2026-06-04: Maintainer flagged old tickets with un-updated status as a process failure + made
  status updates mandatory for agents.
- [2026-06-11] test evidence: 8 new KIT-T028 tests in scripts/test-hooks.mjs; npm test + node scripts/test-hooks.mjs → 119 passed, 0 failed.

## History
- [2026-06-11 06:14] (status) todo → doing
- [2026-06-11 06:21] (comment) ticked: Agent-handoff template + /work + /drain mandate the status transitions (start→doing, done→review, bail→todo).
- [2026-06-11 06:21] (comment) ticked: No existing hook weakened.
- [2026-06-11 06:22] (comment) ticked: A stale-status detector surfaces contradictions (and could gate Stop, like the request ratchet).
- [2026-06-11 06:22] (status) doing → done
