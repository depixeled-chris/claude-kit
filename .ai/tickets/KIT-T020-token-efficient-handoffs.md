---
id: KIT-T020
title: Research — make agent handoffs more token-efficient (provenance by reference, not inline)
type: research
status: doing
priority: high
labels: [research, agents, tokens, provenance]
links: [KIT-D018, KIT-D017, KIT-T018]
files: [docs/]
created: 2026-06-04T12:31:00Z
updated: 2026-06-04T12:31:00Z
---

## Description
Handoffs currently inline whole tickets + guards + context into every agent prompt (expensive,
and grows with provenance per KIT-D018). Research how to keep handoffs provenance-grounded yet
token-lean: pointers (ticket id + file:line ranges) the agent reads on demand vs inline dumps;
shared/standing guard docs referenced by name; structured-output schemas; reusable project-agent
system prompts (so per-task prompts shrink); summarized vs full context; measuring handoff token
cost. Tension to resolve: KIT-D018 grounding vs token economy — reference, don't paste.

## Acceptance Criteria
- [ ] Research doc: concrete techniques to cut handoff tokens while preserving provenance, with
      tradeoffs + a recommended handoff template.
- [ ] Recommendation reconciled with KIT-D018 (grounding stays; it's by reference).
- [ ] Quantify where tokens go in current handoffs + projected savings.

## Notes
- 2026-06-04: Maintainer ask. Should directly shape the KIT-T018 handoff template.
