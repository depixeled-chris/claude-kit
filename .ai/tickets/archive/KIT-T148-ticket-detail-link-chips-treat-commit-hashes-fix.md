---
id: KIT-T148
title: Ticket-detail link chips treat commit hashes (fixed_by/causing_commit) as ticket ids — click yields 'no ticket' error
type: bug
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:15:35Z
updated: 2026-07-23T19:20:56Z
---

## Description
Reported by the maintainer in live UI testing 2026-07-23: FIXED_BY values (git commit
hashes from ticket frontmatter — fixed_commit, causing_commit, and shas inside links)
render as ticket-id links in the detail view; clicking navigates to a "no ticket"
error. The link renderer must distinguish value kinds: ticket/decision/question ids
(<KEY>-[TDQN]\d+) navigate in-app; commit hashes (hex, 7-40 chars) are NOT tickets —
render as a mono chip, linked to the project's commit URL when a GitHub remote is
resolvable (the API can expose remoteUrl per project), else copy-to-clipboard,
never an in-app route.

## Acceptance Criteria
- [x] Link/frontmatter chips classify values: item ids vs commit shas vs plain text; only real item ids get in-app navigation
- [x] Commit shas render as mono chips → GitHub commit URL when the project has a resolvable remote (API exposes it), else non-navigating copy chip
- [x] No "no ticket" dead-end reachable from any chip on detail pages
- [x] Unit test for the classifier (id vs sha vs text)
- [x] ui build + full npm test green

## Plan
1. API: expose remoteUrl per project (git config --get remote.origin.url, normalized).
2. UI: chip classifier + CommitChip component; wire into detail frontmatter/links.
3. Tests + ui:build.

## History
- [2026-07-23 18:15] (created) bug — Ticket-detail link chips treat commit hashes (fixed_by/causing_commit) as ticket ids — click yields 'no ticket' error
- [2026-07-23 19:13] (status) todo → doing
- [2026-07-23 19:20] (comment) ticked: Link/frontmatter chips classify values: item ids vs commit shas vs plain text; only real item ids get in-app navigation
- [2026-07-23 19:20] (comment) ticked: Commit shas render as mono chips → GitHub commit URL when the project has a resolvable remote (API exposes it), else non-navigating copy chip
- [2026-07-23 19:20] (comment) ticked: No "no ticket" dead-end reachable from any chip on detail pages
- [2026-07-23 19:20] (comment) ticked: Unit test for the classifier (id vs sha vs text)
- [2026-07-23 19:20] (comment) ticked: ui build + full npm test green
- [2026-07-23 19:20] (comment) @claude: Evidence: ui/src/lib/chips.test.mjs 19/19 (item ids incl. hyphenated keys + R/E types -> item; 7-40 hex -> commit; too-s (full comment #1 in ## Notes)
### comment #1 [2026-07-23 19:20] @claude
Evidence: ui/src/lib/chips.test.mjs 19/19 (item ids incl. hyphenated keys + R/E types -> item; 7-40 hex -> commit; too-short/too-long/non-hex/prose -> text). server/server.test.mjs 22/22 incl. detail DTO exposes remoteUrl (null off-repo). Full npm test EXIT=0 (db-cache 66/66). cd ui && npm run build green (83 modules). API: getTicketDetail exposes remoteUrl via hooks/lib.remoteWebUrl(project.root); classifier chips.mjs (shared by UI + node test, DRY via chips.d.ts); Chip.tsx renders item->in-app Link, commit sha->mono permalink (remoteUrl/commit/sha) or copy-to-clipboard button (non-navigating), text->inert. Wired into TicketDetail links list so a fixed_commit/causing_commit sha no longer dead-ends on a no-ticket route.
- [2026-07-23 19:20] (status) doing → done
