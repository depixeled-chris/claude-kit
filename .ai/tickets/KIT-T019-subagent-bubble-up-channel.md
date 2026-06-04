---
id: KIT-T019
title: Subagent bubble-up — agents surface communication to orchestrator AND maintainer (not only at completion)
type: feature
status: todo
priority: high
milestone:
labels: [agents, orchestration, capture]
links: [KIT-D017, KIT-D018, KIT-D015]
files: [agents/, commands/drain.md]
created: 2026-06-04T12:06:00Z
updated: 2026-06-04T12:06:00Z
---

## Description
Subagents need to bubble communication UP — questions, blockers, discovered requests, partial
findings — to the orchestrator and to the maintainer, mid-task, not only in the final result.

Observed harness limit (2026-06-04): the orchestrator has NO `SendMessage` tool here, so it cannot
steer a running background agent, and background agents only report at completion — there is no
mid-flight push. So bubble-up needs a mechanism, likely two layers:
- **Durable (works today):** agents WRITE to the shared `.ai` stores during work — a discovered
  request → `inbox/`, a blocker/question → `questions/`, a finding → `notes/`, with a back-link to
  their ticket. The orchestrator polls/surfaces these (and a Stop/poll hook can surface new ones to
  the maintainer). This is provenance-native (KIT-D018) and survives /clear (KIT-D015).
- **Live (harness-dependent):** a real mid-flight agent→orchestrator→maintainer channel, IF/when
  the harness supports it. Flag as dependent; design the durable layer first.

## Acceptance Criteria
- [ ] Agent-handoff template instructs agents to write blockers/questions/discovered-requests to the
      shared `.ai` stores (with ticket back-links) DURING work, not just at the end.
- [ ] Orchestrator (drain) surfaces newly-written questions/inbox items to the maintainer promptly.
- [ ] Documented: the harness mid-flight-push limitation + the durable workaround.

## Notes
- 2026-06-04: Maintainer: "subagents need to be able to bubble any communication back up to you and
  me." Part of the 'workflow' project's agent-coordination model too (see /d/dev/workflow
  scripts/orchestrator + .claude/AGENT_WORKFLOW.md).
