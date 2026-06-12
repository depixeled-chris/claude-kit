---
id: KIT-T038
title: "Big/complex asks auto-trigger a plan → research → task-loop pipeline (not a single ad-hoc reply)"
type: feature
status: done
priority: medium
milestone:
labels: [drain, plan, research, task-loop, dx, orchestration]
links: [KIT-T017]
aka: []
files: []
created: 2026-06-05T00:00:00Z
updated: 2026-06-12T15:35:16Z
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
- [x] A complexity/size heuristic at request intake distinguishes a "big ask" from a routine one.
- [x] A big ask routes into plan → research → task-loop (plan recorded, research doc written,
      tickets created) instead of a single ad-hoc reply.
- [x] The trigger composes with the existing drain/always-on loop (KIT-T017) rather than duplicating it.
- [x] Routine asks are unaffected (no plan/research overhead forced on small items).

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
- 2026-06-12: Implemented. Chose mechanism (b) composed with (a) as planned: a UserPromptSubmit
  hook (`hooks/big-ask-nudge.mjs`) that detects co-occurrence of (1) prompt length ≥ 150 chars AND
  (2) a scope/risk signal (redesign, architecture, migrate, from scratch, overhaul, end-to-end,
  system-wide, etc.). Advisory-only: stderr nudge, exit 0 always — never blocks. No-ops on
  unadopted repos; fail-open on parse errors. The AND requirement is the AC4 invariant — length
  alone or signal alone is not a big ask. Contract prose added to drain.md + work.md as the
  authoritative rule the hook backs up. KIT-T017 composition: the hook fires at prompt intake,
  the drain/work contracts handle execution — no duplication, no new loop machinery introduced.
  17 tests all pass; full npm test suite green.

## History
- [2026-06-12 15:27] (status) todo → doing
- [2026-06-12 15:34] (comment) ticked: A complexity/size heuristic at request intake distinguishes a "big ask" from a routine one.
- [2026-06-12 15:34] (comment) ticked: The trigger composes with the existing drain/always-on loop (KIT-T017) rather than duplicating it.
- [2026-06-12 15:34] (comment) ticked: A big ask routes into plan → research → task-loop (plan recorded, research doc written,
- [2026-06-12 15:34] (comment) ticked: Routine asks are unaffected (no plan/research overhead forced on small items).
- [2026-06-12 15:35] (status) doing → review
- [2026-06-12 15:35] (status) review → done
