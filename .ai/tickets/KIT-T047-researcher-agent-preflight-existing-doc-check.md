---
id: KIT-T047
title: researcher/design-doc agent preflight — search prior art (docs/research + cited docs) before commissioning, EXTEND the canonical doc, never spawn a parallel one
type: tech-debt
status: todo
priority: medium
milestone:
labels: [process-failure, agents]
links: [KIT-T041, KIT-T042]
files: []
supersedes:
superseded_by:
created: 2026-06-06T02:35:00Z
updated: 2026-06-06T02:35:00Z
---

## Description
PROCESS MISS (2026-06-05, HOD): a researcher/design-doc agent was commissioned for buildings WITHOUT first searching docs/research/ for the existing canonical doc (enterable-buildings.md) the phase tickets already cite → produced a duplicate doc; cost a researcher run + a reconciliation merge. Root causes: (1) the SESSION spine listed one buildings doc but not the canonical one → trusted an incomplete hand-maintained index; (2) no queryable research-doc index (KIT-T041/T042 — the index half). This ticket is the BEHAVIOR half: before launching a researcher/design-doc agent on a topic, search docs/research/ AND the topic's tickets' cited docs for prior art; EXTEND the canonical doc, never commission a parallel one.

## Acceptance Criteria
- [ ] A documented preflight step (and ideally an automated check) runs before any researcher/design-doc agent spawn: grep docs/research/ + the topic tickets' cited docs for an existing canonical doc on the topic.
- [ ] If a canonical doc exists, the agent is instructed to EXTEND it (not author a parallel doc).
- [ ] Depends on / composes with the research-doc cache index (KIT-T041/T042) so the preflight can query the cache rather than raw grep.

## Plan
1.

## Notes
- 2026-06-06: split from the 2026-06-05 process-miss cap. The index half is KIT-T041/T042; this is the agent-preflight behavior half.
