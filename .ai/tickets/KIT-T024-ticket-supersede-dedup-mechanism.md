---
id: KIT-T024
title: Ticket-level supersede + dedup — a new ticket can retire an old one and take it out of the drain
type: feature
status: review
priority: high
labels: [tickets, dedup, drain, schema, hooks]
links: [KIT-T009, KIT-D017]
files: [scripts/next-id.mjs, scripts/index-tickets.mjs, .ai/tickets/_TEMPLATE.md, commands/drain.md]
created: 2026-06-04T15:00:00Z
updated: 2026-06-04T15:00:00Z
---

## Description
Decisions have `supersedes:`; TICKETS do not. Tickets only have `links:` + statuses, so a newer
ticket cannot formally retire an older duplicate, and nothing stops the drain (or a subagent) from
working a ticket already obsoleted by another. This causes duplicate effort — exactly what the
maintainer flagged. (Adjacent to the earlier "capture/triage must DEDUPE related requests" ask.)

## Acceptance Criteria
- [x] Ticket schema gains `supersedes:` / `superseded_by:` and a `superseded` status (or equivalent)
      that REMOVES the ticket from the drain + INDEX active set, with a pointer to the replacement.
- [x] `index-tickets.mjs` renders supersede chains (like REGRESSIONS) and excludes superseded tickets from the active/drain list.
- [x] A dedup CHECK at capture/triage/`next-id`: flag likely-duplicate tickets (title/label/file overlap or similarity) so the operator links or supersedes instead of creating a dup.
- [x] drain contract: never start a ticket that is `superseded` or whose work is subsumed by its `superseded_by`.

## Notes
- 2026-06-04: Maintainer asked whether a new ticket supersedes an old one to prevent duplicate
  effort — it doesn't, for tickets. This adds it.
- 2026-06-04: Implemented. Markdown stays truth; cache derived/fail-open (no write-back).
  - Schema: `supersedes:`/`superseded_by:` frontmatter (both ticket templates) + off-board
    `superseded` status in config.yml. Parsed in db-parse, hydrated as `supersedes`/
    `superseded_by` link edges, wired into q.mjs `edgesOf` (markdown-scan parity).
  - Active-set exclusion: ONE predicate `isSuperseded` (status `superseded` OR a `superseded_by`
    pointer) drops a ticket from the drain — q.mjs `open` (cache SQL + scan) and index-tickets'
    Active board both use it (belt-and-suspenders so a missed status flip can't leak a dup).
  - index-tickets: new `## Superseded` board section + generated `.ai/SUPERSEDED.md` chain file
    (older→newer, like REGRESSIONS), fed by the cache `supersedes` query, fail-open to markdown.
  - Dedup detector: q.mjs `similar` query (FTS OR-of-terms, suggest-only, excludes superseded/
    archived) + a markdown-scan fallback at parity. Surfaced from `next-id … -- <proposed title>`
    on stderr (never blocks; id always prints) and documented in triage.md.
  - drain.md: contract says never start a superseded ticket; trust `q.mjs open`.
  - Tests: extended db-cache.test.mjs (+9 supersede/dedup cases, 29 pass); full `npm test` green.
- 2026-06-04: DESIGN FORK RESOLVED → AUTO per KIT-D021 (automate over manual; suggest-only
  rejected on reliability grounds). Supersede is now AUTOMATICALLY + IDEMPOTENTLY reconciled in
  the markdown source of truth: declaring the relationship on EITHER side (`supersedes:` on the
  newer ticket OR `superseded_by:` on the older) makes the tooling (a) write the reciprocal
  pointer on the other ticket and (b) flip the retired ticket to `status: superseded`.
  - SEAM: `scripts/reconcile-supersede.mjs` (new, atomic — one responsibility), invoked from
    `scripts/index-tickets.mjs` at the TOP of its run, before the board is read/generated. That
    script is the deterministic, automatic board-reconcile pass: it already reads every ticket,
    already WRITES markdown (the derived INDEX/SUPERSEDED/ROADMAP), and is OUT of the
    PreToolUse/commit enforcement hot path. So the flip happens whenever the board is rebuilt
    (triage/ticket changes), not by a remembered manual step.
  - This is the TOOLING writing the markdown source of truth (allowed). It is NOT cache
    write-back — the SQLite cache stays one-way/read-only/fail-open (unchanged).
  - SAFETY: only ever flips TO `superseded`; never un-flips, never edits a ticket with no
    supersede pointer on either side, never touches the live replacement's status; archived
    tickets are excluded. Idempotent — re-running once consistent rewrites nothing.
  - LOGS what it changed (which ticket flipped, which reciprocal pointer was written) on stdout.
  - Tests: db-cache.test.mjs +7 reconcile cases (hermetic temp-.ai): one-sided `supersedes`
    auto-writes reciprocal `superseded_by` + flips status; idempotent second run (no change, no
    bytes rewritten); retired ticket excluded from `q.mjs open`. Full `npm test` green (36 in
    db-cache).
