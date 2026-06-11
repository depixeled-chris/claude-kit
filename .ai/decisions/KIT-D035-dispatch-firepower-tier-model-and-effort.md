---
id: KIT-D035
title: "Dispatch firepower is one tier (model + effort), not two knobs — sibling to KIT-D022"
date: 2026-06-11
supersedes:
source: conversation 2026-06-10 (KIT-T034 AC #5) + KIT-D022
links: [KIT-D022, KIT-T034, KIT-T078]
---

**Decision:** A subagent dispatch sets **model AND reasoning-effort together** as a single
"firepower" choice, expressed as a `tier` on the ticket:

- **light**  → (haiku, low)    — mechanical edits, data formatting, search, test/log triage.
- **standard** → (sonnet, medium) — normal atomic code change / bug fix (the everyday default).
- **deep**   → (opus, high)    — planning, architecture, research, epics, reasoning-heavy work.

`tier` is the primary knob; `model:` and `effort:` are OPTIONAL per-axis overrides (a ticket may
run `tier: deep` but pin `model: sonnet` for deep effort on the cheaper model). Absent any field,
the ticket's `type` selects a default tier (`config.dispatch.default_tier`). The map lives in
`.ai/config.yml → dispatch`; the orchestrator reads it at delegation time and passes the resolved
model + effort to the Agent — no code parses it (KIT-T034).

**Why:** KIT-D022 settled model-by-complexity but was model-only; effort is the same axis of
"how much consideration does this need" and splitting it into a second independent knob invites
incoherent pairs (opus + low, haiku + max). Binding both to one tier keeps the firepower decision
coherent and one-line, while the explicit overrides preserve the rare model≠effort case. Distinct
from KIT-T078 (static `model:` on fixed-cost read-only COMMANDS): that tiers a command whose cost
is intrinsic; this tiers the per-ticket WORK a command dispatches — same principle, different
granularity. Rejected: a single `tier` with NO overrides (too rigid for the legitimate
deep-effort-on-sonnet case); keeping model and effort as two free fields with no tier (the
incoherent-pair trap, and two knobs to set where one intent exists).
