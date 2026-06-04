---
id: KIT-T024
title: Ticket-level supersede + dedup — a new ticket can retire an old one and take it out of the drain
type: feature
status: todo
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
- [ ] Ticket schema gains `supersedes:` / `superseded_by:` and a `superseded` status (or equivalent)
      that REMOVES the ticket from the drain + INDEX active set, with a pointer to the replacement.
- [ ] `index-tickets.mjs` renders supersede chains (like REGRESSIONS) and excludes superseded tickets from the active/drain list.
- [ ] A dedup CHECK at capture/triage/`next-id`: flag likely-duplicate tickets (title/label/file overlap or similarity) so the operator links or supersedes instead of creating a dup.
- [ ] drain contract: never start a ticket that is `superseded` or whose work is subsumed by its `superseded_by`.

## Notes
- 2026-06-04: Maintainer asked whether a new ticket supersedes an old one to prevent duplicate
  effort — it doesn't, for tickets. This adds it.
