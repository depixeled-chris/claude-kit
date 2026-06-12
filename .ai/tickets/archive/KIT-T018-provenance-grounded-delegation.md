---
id: KIT-T018
title: Enforce provenance-grounded delegation (D018) — triage-to-ticket before delegate; handoff embeds ticket+links
type: feature
status: done
priority: high
milestone:
labels: [drain, agents, contract, provenance]
links: [KIT-D018, KIT-D017, KIT-T015]
files: [commands/drain.md, commands/work.md, agents/]
created: 2026-06-04T12:05:00Z
updated: 2026-06-12T18:05:59Z
---

## Description
Make KIT-D018 structural: a captured item is triaged into a ticket (with links + Notes history)
BEFORE delegation, and the agent handoff EMBEDS that ticket + its linked decisions/docs (incl.
prior FAILED attempts) so the agent builds on the record, not the prompt-author's memory. Agent
results feed back into ticket Notes (append-only).

## Acceptance Criteria
- [x] drain/work contract + the standard agent-handoff template require: ticket id + its links/
      history + governing decisions/docs embedded in every handoff.
- [x] The handoff template includes the out-of-scope/legacy guard and the verify-as-the-user-plays rule.
- [x] Example/lint: a delegation citing no ticket is flagged.
- [x] No existing hook weakened.

## Notes
- 2026-06-04: Motivated by a "fix textures" agent re-running an already-rejected parametric approach
  because it lacked HOD-T054's history.
- 2026-06-12: Shipped. verify-as-user-plays clause added to both commands/work.md (in the handoff
  guard block) and commands/drain.md (subagent fan-out section). Ticket-citation lint added to
  hooks/agent-roster.mjs as advisory stderr warn (exit 0 always, fail-open). 4 new tests in
  agent-roster.test.mjs — ticket-less Task warns, KIT-T001 Task silent. npm test: 33 passed, 0 failed.

## History
- [2026-06-12 18:00] (status) todo → doing
- [2026-06-12 18:05] (comment) ticked: drain/work contract + the standard agent-handoff template require: ticket id + its links/
- [2026-06-12 18:05] (comment) ticked: Example/lint: a delegation citing no ticket is flagged.
- [2026-06-12 18:05] (comment) ticked: The handoff template includes the out-of-scope/legacy guard and the verify-as-the-user-plays rule.
- [2026-06-12 18:05] (comment) ticked: No existing hook weakened.
- [2026-06-12 18:05] (status) doing → done
