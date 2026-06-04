---
id: KIT-D018
title: "Provenance-grounded delegation — every agent handoff is built on the ticket/decision/doc record, not the model's memory"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04 (maintainer directive)
links: [KIT-D017, KIT-D015, KIT-D002]
---

**Decision:** Nothing is handed to a subagent from the orchestrator's head. Every delegation is
grounded in the durable record: the relevant TICKET (with its acceptance criteria, Notes/history,
and `links` to related tickets/decisions), the governing DECISIONS, and any research/CODEMAP docs.
Operationally:
- A captured item is TRIAGED into a ticket (with provenance: links + a Notes history) BEFORE it is
  delegated. Capture → triage-to-ticket → delegate-on-the-ticket → drain.
- The agent handoff EMBEDS or points at that ticket + its linked decisions/docs, so the agent
  builds on prior context (including prior FAILED attempts) instead of rediscovering or repeating.
- The agent's result feeds back into the ticket Notes (history is append-only), so the next
  handoff inherits it.

**Why:** This is the same anti-amnesia principle the orchestrator follows (on-disk record over
memory), extended to every subagent. The failure it fixes, observed live: a "fix the textures"
agent re-did a parametric tweak with no knowledge that the same approach had already been tried and
rejected; agents were dispatched with head-written prompts citing decisions only in passing. Memory
is flaky and per-agent; the ticket/doc graph is the shared, durable source of truth — so it, not
the prompt author's recollection, must be what work is built on. Reinforces KIT-D017 (the loop) and
KIT-D015 (lose nothing): provenance is what survives a /clear and what makes a fresh agent correct.
