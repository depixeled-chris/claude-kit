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
- 2026-06-04: DESIGN FORK left for maintainer — does superseding auto-flip the old ticket's
  status, or only require the pointer? Implemented as OPERATOR-SET (suggest-only): the dedup hint
  surfaces candidates but never mutates a ticket. The active-set exclusion already fires on the
  pointer alone, so a forgotten status flip is harmless. Did NOT auto-mutate (markdown-is-truth;
  the cache is read-only). Confirm this is the desired ergonomics or whether triage should
  auto-set `status: superseded` on the retired ticket when it sets the pointer.
