---
id: KIT-T018
title: Enforce provenance-grounded delegation (D018) — triage-to-ticket before delegate; handoff embeds ticket+links
type: feature
status: todo
priority: high
milestone:
labels: [drain, agents, contract, provenance]
links: [KIT-D018, KIT-D017, KIT-T015]
files: [commands/drain.md, commands/work.md, agents/]
created: 2026-06-04T12:05:00Z
updated: 2026-06-04T12:05:00Z
---

## Description
Make KIT-D018 structural: a captured item is triaged into a ticket (with links + Notes history)
BEFORE delegation, and the agent handoff EMBEDS that ticket + its linked decisions/docs (incl.
prior FAILED attempts) so the agent builds on the record, not the prompt-author's memory. Agent
results feed back into ticket Notes (append-only).

## Acceptance Criteria
- [ ] drain/work contract + the standard agent-handoff template require: ticket id + its links/
      history + governing decisions/docs embedded in every handoff.
- [ ] The handoff template includes the out-of-scope/legacy guard and the verify-as-the-user-plays rule.
- [ ] Example/lint: a delegation citing no ticket is flagged.
- [ ] No existing hook weakened.

## Notes
- 2026-06-04: Motivated by a "fix textures" agent re-running an already-rejected parametric approach
  because it lacked HOD-T054's history.
