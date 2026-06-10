---
id: KIT-T020
title: Research — make agent handoffs more token-efficient (provenance by reference, not inline)
type: research
status: done
priority: high
labels: [research, agents, tokens, provenance]
links: [KIT-D018, KIT-D017, KIT-T018]
files: [docs/]
created: 2026-06-04T12:31:00Z
updated: 2026-06-10T06:00:00Z
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
- 2026-06-04 COST (from /usage: 84% of spend was at >150k context): the orchestrator context
  staying long is the dominant cost. Levers:
  (a) RETURN side — agents must WRITE detail to the doc/ticket and return a TERSE summary + pointer,
      NOT dump full results into the orchestrator's context (big agent results were a top inflater).
  (b) Orchestrator stays lean — delegate investigation/reads to agents (their context dies with them);
      don't read big files into the main context.
  (c) /clear discipline — SESSION.md is kept live so /clear is ALWAYS safe; clear at task boundaries /
      checkpoints to stay out of the >150k band (KIT-D015 makes this lossless).
  (d) SQLite cache (KIT-T004) "query don't open files" cuts per-turn retrieval tokens.

## Worklog
- 2026-06-04: status doing→review — research doc landed: 4fee357 (docs/research/token-efficient-handoffs.md; provenance-by-reference-not-paste + recommended handoff template). (reconciliation, KIT-T028)
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
