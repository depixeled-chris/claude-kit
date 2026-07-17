---
id: KIT-D043
title: "Standard tier moves to opus; sonnet off the coding ladder; the ladder is the LIVING routing hierarchy"
date: 2026-07-16
supersedes:
source: maintainer directive 2026-07-16 (groovegrid drain), refined same day; re-stated 2026-07-17 ("core to Claude Kit… a living hierarchy because things change")
links: [KIT-D022, KIT-D035, KIT-D042, KIT-T128]
---

**Decision:** The KIT-D035 firepower ladder changes at the `standard` tier, and the
ladder itself is declared the **living model-routing hierarchy** — the ONE home for
model-choice judgments:

- **light**    → (haiku, low)  — unchanged: trivial mechanical work, formatting, search, triage.
- **standard** → (opus, medium) — ALL everyday coding/implementation. Was (sonnet, medium).
- **deep**     → (fable, high), `fallback: opus` — unchanged (KIT-D042): orchestration,
  planning, hardest reasoning, budget permitting. On a fable USAGE-LIMIT error mid-work,
  relaunch the same delegation on opus immediately.

`sonnet` leaves the ladder for coding entirely — it remains a legal explicit per-ticket
`model:` override (KIT-D035 resolution order unchanged), but no tier and no default routes
coding to it.

**Why:** Sonnet 5 carries the 4.7-era tokenizer (~1x–1.35x the tokens of Sonnet 4.6 for
the same content at the same per-token price), eroding its efficiency edge over Opus;
Opus 4.8 is simply better at coding (verified against the claude-api reference
2026-07-16). Fable budget is scarce and shared with the orchestrating session — burning
it on basic work starves orchestration (the lived failure: a trivial widget-width fix
headed for main-thread fable while a fable subagent died on the usage limit mid-ticket).

**Living hierarchy (the meta-decision):** model-routing judgments are DATED,
lineup-dependent facts — they rot. They live in the ladder (`config.dispatch.tiers` +
the decision trail here), updated at the source when the model lineup changes, and
NEVER in a per-project memory (the groovegrid `delegate-basics-off-fable` memory is
retired by KIT-T128). A future lineup change = a new decision superseding this one +
a tiers edit, propagated by the normal kit update path.

**Rejected:** keeping sonnet as `standard` with a memory-level "don't use it" note
(memory is per-project and invisible to dispatch); a fourth tier (D042 already rejected
tier proliferation); hard-removing `sonnet` as a legal `model:` value (the explicit
override is the escape hatch KIT-D035 deliberately preserved).
