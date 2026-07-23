---
id: KIT-T148
title: Ticket-detail link chips treat commit hashes (fixed_by/causing_commit) as ticket ids — click yields 'no ticket' error
type: bug
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:15:35Z
updated: 2026-07-23T18:15:35Z
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
- [ ] Link/frontmatter chips classify values: item ids vs commit shas vs plain text; only real item ids get in-app navigation
- [ ] Commit shas render as mono chips → GitHub commit URL when the project has a resolvable remote (API exposes it), else non-navigating copy chip
- [ ] No "no ticket" dead-end reachable from any chip on detail pages
- [ ] Unit test for the classifier (id vs sha vs text)
- [ ] ui build + full npm test green

## Plan
1. API: expose remoteUrl per project (git config --get remote.origin.url, normalized).
2. UI: chip classifier + CommitChip component; wire into detail frontmatter/links.
3. Tests + ui:build.

## History
- [2026-07-23 18:15] (created) bug — Ticket-detail link chips treat commit hashes (fixed_by/causing_commit) as ticket ids — click yields 'no ticket' error
