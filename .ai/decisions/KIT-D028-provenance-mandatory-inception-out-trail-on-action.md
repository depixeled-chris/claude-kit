---
id: KIT-D028
title: "PROVENANCE IS MANDATORY (framework law): inception-out links + trail-on-action. A standard issue-tracker model (epics/parent/typed links), enforced by hooks so it never depends on the agent's memory."
standing: true
scope: process
date: 2026-06-06
supersedes:
source: conversation 2026-06-06 (maintainer law); inbox 2026-06-06-0742
links:
---

**Decision:** Provenance is a first-class, enforced part of the workflow — the same shape Jira and every PM tool already has (epics, parent/child, typed issue links), not a novel invention.

- **Trail nodes (all first-class):** tickets, decisions, RESEARCH/DESIGN DOCS (docs/research, docs/design, docs/strategy — e.g. R050), requests, commits. Documentation is part of the trail.
- **Inception-out linking (the family-tree rule):** when an item is created or related, IT records links OUT to its ANTECEDENTS — the origin it came from + the decisions/docs that informed it. One direction: descendant → ancestors. You never wake an ancestor to register a descendant; the reverse ("what descends from X") is a QUERY (`backlinks`/`children`), never hand-authored.
- **The trail is the graph around the origin:** an item came from something, and that something may also have spawned research, decisions, and sibling tickets — all of it is the trail.
- **Trail-on-action:** before work begins on any item, a SUMMARY of its trail (walk UP the ancestry) MUST be surfaced — DECISIONS first, then DOCS, then tickets. Walking up (governing context) is what an agent needs; walking down is secondary.
- **Token-frugal summaries with a drill-in clue:** every item carries a CONCISE `summary:` (one line — the gist, not the full title/body). A trail surfaces those summaries, NOT full titles/bodies, so the chain is cheap to read. Each line also signals whether the node has MORE detail behind it (a `…` / has-body marker), so the agent can decide whether to drill into that specific element WITHOUT token-stuffing the whole chain. The verbose title/body is fetched only for the node the agent chooses to open.

**Why:** HOD-D003 (Rust owns world-gen) and R050 (the world design doc) never surfaced while HOD-T106 was worked, so an entire arc of effort ran against the actual architecture. The cause was a broken/absent inception-out link (T106 pointed at a wrong record instead of D003). The fix can't be "the agent should remember" — it must be enforced by hooks (`q trail`, a ticket-start gate, a missing-antecedent lint), so the guardrail fires regardless of the agent. Enforcement work: [[KIT-T048]].
