---
id: KIT-D042
title: "Fable tops the firepower ladder: deep tier prefers fable, falls back to opus on unavailability"
date: 2026-07-15
supersedes:
source: maintainer directive 2026-07-15 (AskUserQuestion on fable placement)
links: [KIT-D022, KIT-D035, KIT-T034, KIT-T127]
---

**Decision:** The Claude 5 `fable` model (Mythos-class, above Opus) joins the KIT-D035
firepower ladder as the `deep` tier's PRIMARY model:

- **deep** → (fable, high), `fallback: opus` — planning, architecture, research, epics,
  the hardest problem solving.
- **light** and **standard** are unchanged (haiku/low, sonnet/medium).

`fallback:` is a new optional per-tier key: the model to retry the SAME delegation with when
the primary is unavailable at dispatch (the harness rejects the model value). It handles
AVAILABILITY only — the orchestrator never uses it as a silent cost downgrade, and notes the
substitution in the receipt. `model:`/`effort:`/`tier:` ticket overrides keep their KIT-D035
resolution order; `fable` is a valid `model:` override value on any ticket.

**Why:** Maintainer directive: fable is preferred for planning and really hard problem
solving — exactly the `deep` tier's charter — but may not always be available, so dispatch
must degrade gracefully to opus rather than fail or quietly inherit the parent model
(the KIT-D022 bleed). Rejected: a fourth tier above `deep` (two tiers with the same charter,
and D035 chose one coherent knob); fable as override-only (hides the preferred model for
deep work behind a field nobody sets by default).
