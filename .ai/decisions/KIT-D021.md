---
id: KIT-D021
title: "Automate over manual — never depend on a remembered manual step; encode/enforce it"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04 (maintainer)
links: [KIT-T024, KIT-T025]
---

**Decision:** Any recurring operating/reconciliation step defaults to **automated +
enforced**, never "the operator/agent will remember to do it." Manual steps are unreliable
— especially for an AI agent. If a rule or a reconciliation matters, encode it in the
tooling/hooks so it happens deterministically and idempotently. This generalizes the
existing "Enforcement is hooks, not judgment" rule to all workflow mechanics.

Concrete trigger: ticket supersede (KIT-T024). The retired ticket's `status: superseded`
and the reciprocal supersede pointer must be set **automatically** when a supersede
relationship is declared — NOT left as an operator-set/suggest-only step.

**Why:** Maintainer (2026-06-04): "Why would we want to keep it manual? You realize how
unreliable you are with anything manual?" The suggest-only design surfaced as KIT-T024's
open fork was rejected on exactly this reliability ground.

**How to apply:** When designing any workflow step, ask "what enforces this?" — a hook, a
sync/reconcile pass, or generated output — not a human/agent habit. Reserve "manual" only
for genuine judgment calls (e.g. a `human_only` status). The cache invariant is unchanged:
tooling writes the markdown source of truth; the derived cache is still read-only/one-way.
