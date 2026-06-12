---
id: KIT-T038
title: "Big/complex asks auto-trigger a plan → research → task-loop pipeline (not a single ad-hoc reply)"
type: feature
status: todo
priority: medium
milestone:
labels: [drain, plan, research, task-loop, dx, orchestration]
links: [KIT-T017]
aka: []
files: []
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Description
A large or complex request should automatically engage a structured pipeline —
**plan → research → task loop** — rather than being answered as a one-shot reply. Today the
model decides case-by-case whether to research-first / plan-first, so big asks can skip the
research-first discipline (MEMORY: research-first) and the always-on drain loop (KIT-T017),
landing as an under-scoped single answer.

Wanted: a size/complexity signal at intake that routes a "big ask" into the established
chain — draft a plan, spawn the research write-up (docs/research/…), then decompose into
tickets and drain them — so the heavy-effort path is structural, not memory-dependent.

## Acceptance Criteria
<!-- Each must be a checkable observation. -->
- [ ] A complexity/size heuristic at request intake distinguishes a "big ask" from a routine one.
- [ ] A big ask routes into plan → research → task-loop (plan recorded, research doc written,
      tickets created) instead of a single ad-hoc reply.
- [ ] The trigger composes with the existing drain/always-on loop (KIT-T017) rather than duplicating it.
- [ ] Routine asks are unaffected (no plan/research overhead forced on small items).

## Plan
Scoped 2026-06-12 (drain). MOST design-gated of the three: criteria were reconstructed from a
stray cap (Notes below), so the ticket itself asks to confirm scope before building; AND it must
"compose with the always-on loop (KIT-T017)", which is **todo** (not yet operationalized). Two
real unknowns need a maintainer call before code:
1. **The "big-ask" trigger mechanism** — pick one: (a) CONTRACT-PROSE heuristic (the model
   self-classifies at intake against documented size/risk thresholds — no new machinery, but
   judgment-dependent, the very thing the ticket wants to remove); (b) a HOOK nudge
   (UserPromptSubmit/PreToolUse detects size/risk signals and injects the plan→research→task-loop
   reminder — structural, but heuristic keyword matching is noisy); (c) an explicit `/big` command
   the maintainer fires. Recommend (b) composed with (a) as the fallback.
2. **Ordering vs KIT-T017** — the trigger plugs into the always-on loop; build T017 first (or at
   least define its surface) so this composes rather than duplicates.
Recommendation: DEFER until KIT-T017 lands + a scope-confirm on the trigger mechanism (1).
Routine-ask safety (AC4) is the hard part of any mechanism — must not tax small items.

## Notes
- [2026-06-05 20:16] (comment) folded from triage: PROCESS: a "big ask" must TRIGGER a feedback loop, not reactive edits. When an ask
exceeds a size/risk threshold, the workflow should require: research (docs/research/) → a plan
broken into tasks + documentation → maintainer review/steer (the loop) BEFORE implementation.
Small asks proceed; big asks decompose first. Make this a detectable trigger in the drain/work
contract (and ideally a hook nudge), so it's structural, not the model's judgment. First applied
2026-06-04: the "varied + enterable buildings" ask → routed to research before any code.
<!-- append-only -->
- 2026-06-05: Triaged from KIT inbox cap `2026-06-04-1136-big-asks-trigger-plan-research-task-loop`.
  The cap body was a stray capture-script `echo` artifact (no prose); intent reconstructed from
  the slug. Title/criteria are a best-effort reconstruction — confirm scope with maintainer before
  building. Adjacent to KIT-T017 (operationalize the always-on loop).
