---
id: KIT-T025
title: General deduplication strategy across the whole workflow (capture → inbox → tickets → decisions → memory)
type: feature
status: doing
priority: high
labels: [dedup, capture, tickets, decisions, memory, strategy]
links: [KIT-T024, KIT-D017, KIT-D018]
files: [scripts/, hooks/, commands/]
created: 2026-06-04T15:05:00Z
updated: 2026-06-12T17:56:09Z
---

## Description
KIT-T024 adds the ticket supersede MECHANIC; this is the STRATEGY around it — a coherent,
system-wide approach so duplicates don't accumulate in ANY store. Needs design (research-first):
- **Similarity detection**: how to recognize a near-duplicate (title/label/file/topic overlap;
  cheap text similarity; later embeddings) at the moment of capture AND in a periodic sweep.
- **Canonicalization**: one canonical item; others link/merge/supersede to it. Define the flow per
  store — inbox items, tickets (KIT-T024 supersede), decisions (supersedes:), memory files.
- **At capture vs on triage vs sweep**: when each runs; what's automatic vs operator-confirmed.
- **No silent loss**: merging/superseding must preserve the content trail (per memory hygiene —
  present, don't silently prune).

## Acceptance Criteria
- [ ] A design doc: the unified dedup strategy across all stores, with the detection method, the
      merge/link/supersede flows per store, and where it runs (capture/triage/sweep). Maintainer review.
- [ ] Reconciled with KIT-T024 (tickets), decisions' `supersedes:`, and memory hygiene (no silent prune).
- [ ] Should be designed TOGETHER with KIT-T023 (active context surfacing) and KIT-T024 — one
      coherent "context + dedup integrity" design, not three fragmented ones (ironically, avoid dup effort).

## Notes
- [2026-06-05 20:16] (comment) folded from triage: triage/cap DEDUPE: when a new request is captured, detect whether it relates to an existing ticket/inbox item and CONSOLIDATE into it (don't create a duplicate). Belongs with the relationship-graph work (KIT-T003) + capture (KIT-T006)
- 2026-06-04: Maintainer: "Some kind of deduping strategy in general is also necessary."
- 2026-06-04: MECHANIC generalized (the suggest-at-capture half). KIT-T024's `similar` dedup
  detector was ticket-only; KIT-T025 makes it cross-store WITHOUT forking a second similarity
  impl (DRY, per the ticket's reuse rule):
  - `q.mjs similar` now takes an optional leading `--store <tickets|decisions|notes|questions>`,
    parsed in ONE shared helper (`parseSimilar`) used by BOTH the cache SQL and the markdown-scan
    fallback, so they stay at parity. Default store = `tickets` → KIT-T024 callers unchanged.
    The store filter replaces the hardcoded `i.store = 'tickets'` in the FTS query and the scan.
  - `next-id.mjs` dedup hint generalized: was gated `store === 'tickets'`; now ANY store with a
    `-- <proposed title>` surfaces same-store duplicate candidates on stderr (suggest-only,
    fail-open, id always prints). So creating a decision/note/question through next-id gets the
    same "link or supersede instead of duplicating" hint a ticket does.
  - triage.md updated to use `similar --store <s>` for the target store.
  - Cache stays one-way/read-only/fail-open; markdown is truth (no write-back). Resolution
    (supersede + auto-reconcile) is the KIT-T024 mechanism already built — not re-implemented.
  - Tests: db-cache.test.mjs +3 (cross-store scan confinement, ticket-default back-compat,
    cache==scan parity for `--store decisions`). Full `npm test` green: 39 in db-cache (was 36),
    23 / id-utils 19 / code-graph 18 — all pass.
- 2026-06-04: STATUS held at `todo` — AC NOT fully met; two items need the maintainer:
  - AC-1 (design doc + MAINTAINER REVIEW) is a human_only gate I can't self-approve. The mechanic
    is built; the *written unified strategy* + sign-off are outstanding.
  - AC-3 (co-design with KIT-T023 active-context + KIT-T024 as ONE coherent design) needs the
    maintainer's call on scope/sequencing across three tickets.
  - OPEN FORK (policy, surfaced per KIT-D021 not silently picked): the AC mentions a "periodic
    SWEEP" for cross-store dups. Per KIT-D021 (automate>manual), a sweep should be AUTOMATED — but
    *which RESOLUTION* the sweep takes is the real fork:
      (A) sweep stays SUGGEST-ONLY across all stores (report likely dups in the board/INDEX;
          operator/agent links/supersedes). Safe, but relies on a remembered follow-up — the exact
          reliability gap KIT-D021 rejects.
      (B) sweep AUTO-RESOLVES only the unambiguous case (e.g. ≥N shared terms AND identical
          normalized title) by writing a `supersedes` edge, then letting the existing
          reconcile-supersede pass flip status — deterministic + idempotent like KIT-T024's
          reconcile, but risks a wrong auto-merge on a false positive.
      (C) auto for tickets (drain-affecting, where a dup is costly), suggest-only for
          decisions/notes/questions (where a "dup" is often deliberate nuance, e.g. KIT-D018
          refining KIT-D017 — superseding it would LOSE the trail).
    Sub-question this turns on: does dedup even MEAN the same thing for decisions/notes as for
    tickets? Decisions already model evolution via `supersedes:` + links; many near-duplicate
    decisions are intentional refinements, not waste. Recommend (C) + suggest-only at capture
    (already shipped), but this is the maintainer's policy call.
- 2026-06-05: FORK RESOLVED — maintainer LOCKED option (C): auto-resolve only UNAMBIGUOUS
  *ticket* duplicates; decisions/notes/questions stay SUGGEST-ONLY; capture stays suggest-only.
  Per KIT-D021 the resolution is AUTOMATED + deterministic + idempotent (not a remembered manual
  step). Ticket auto-dedup IMPLEMENTED in the existing automated reconcile pass — no fork hit:
  - HOME: added `autoDedupTickets(root)` to `scripts/reconcile-supersede.mjs`, run as a
    deterministic step right BEFORE `reconcileSupersede` in `scripts/index-tickets.mjs` (the
    same automatic board-rebuild pass; OUT of the PreToolUse/commit hot path).
  - STRICT MATCH BAR (unambiguous = near-certain): a pair is auto-resolved ONLY when BOTH hold —
    (1) same scope + IDENTICAL normalized title (`normTitleKey`: lowercase → strip non
    letter/digit/space → collapse whitespace), AND (2) the KIT-T024 `similar` detector (reused
    via `query('similar','--store tickets',title)`, NOT forked) independently surfaces the other
    ticket as a same-store shared-term candidate. Merely-similar (different title) tickets are
    only SURFACED, never auto-resolved. `store='tickets'` only; never across scopes.
  - SURVIVOR RULE: deterministic — the LOWER id (original/canonical) survives; the HIGHER id
    (later duplicate) is superseded. Auto-dedup only WRITES the `supersedes` edge (survivor →
    loser); the existing reconcile then flips the loser to `status: superseded` + writes the
    reciprocal pointer — resolution flows through the ONE KIT-T024 mechanism (no re-implemented
    flip). A survivor that already supersedes a different ticket is left for the operator.
  - IDEMPOTENT: once the edge exists the loser is superseded → dropped from the active candidate
    set → re-run is a no-op (0 changes, no bytes rewritten). LOGS each auto-resolution.
  - Tests: db-cache.test.mjs +8 (47, was 39): (a) two same-title tickets → higher-id auto-
    superseded + reciprocal + dropped from `q.mjs open`; (b) merely-similar NOT auto-resolved;
    (c) identical-title DECISIONS NOT auto-resolved; (d) idempotency. Full `npm test` green
    (db-cache 47 / 23 / id-utils 19 / code-graph 18). Hot path untouched.
  - STATUS stays `todo`: this completes the ticket auto-dedup MECHANIC; AC-1 (written unified
    design doc + maintainer review) + AC-3 (co-design w/ KIT-T023/T024) remain human-gated.
- 2026-06-12: Design doc written (jointly with KIT-T023, as one coherent design per AC-3): `docs/research/context-and-dedup-integrity.md` — documents the full dedup strategy (per-store semantics, detection method, three run-points, autoDedupTickets mechanic, phased plan). Ready for maintainer review.

## History
- [2026-06-12 17:56] (status) todo → doing
