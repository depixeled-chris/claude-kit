---
id: KIT-T150
title: Agent bug/feature capture protocol — init snippet + orient + dispatch briefs instruct agents to cap findings to the store, not just report prose
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-D015, KIT-T130]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:35:02Z
updated: 2026-07-23T18:35:02Z
---

## Description
Maintainer question 2026-07-23 exposed the gap: the kit's init prompt/contract has NO
agent-facing protocol for reporting bugs or feature suggestions the agent itself
notices. Existing capture machinery is maintainer-input-shaped (interjection routing,
request-gate ratchet) or process-failure-shaped (cap bug for workflow breakdowns).
Product findings by agents evaporate unless an orchestrator manually captures them —
proven same day: the KIT-T134 agents surfaced three real findings (8.3 short-name
path bug, stale JV-key ticket note, test-fixture cache pollution) that reached the
store only via the orchestrator. Rule to codify: **noticed ≠ reported until it's in
the store** — any defect/idea an agent encounters gets `cap bug|feature "..."` (or
`t new`) + a one-line receipt in its report; the report cites ids, never carries the
only copy. With the UI (KIT-T129) + mention loop (KIT-T130), agent-filed findings
land directly on the maintainer's boards.

## Acceptance Criteria
- [ ] project-template/CLAUDE.snippet.md gains the agent-capture protocol (a short subsection under the capture cadence: what qualifies, the cap/t-new commands, the receipt-line requirement)
- [ ] orient.mjs IDENTITY block carries the one-line version ("notice a bug/idea → cap it + receipt; reports cite ids")
- [ ] commands/work.md + commands/drain.md dispatch-brief templates instruct dispatched subagents the same (subagents inherit the protocol without per-brief prose)
- [ ] Adopted-repo propagation path stated (template re-sync per the existing template-drift mechanism)
- [ ] Hook/test coverage where feasible: at minimum a test asserting the snippet + orient text contain the protocol markers

## Plan
1. Draft the protocol text once; splice into snippet + orient + both command briefs.
2. Note propagation in the template-drift resync inbox item (c18c1ee origin).
3. Test markers; suite green.

## History
- [2026-07-23 18:35] (created) feature — Agent bug/feature capture protocol — init snippet + orient + dispatch briefs instruct agents to cap findings to the store, not just report prose
