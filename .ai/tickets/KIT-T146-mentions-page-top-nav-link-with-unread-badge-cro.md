---
id: KIT-T146
title: Mentions page + top-nav link with unread badge — cross-project mentions of the resolved user, ack from the UI
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T145, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:13:57Z
updated: 2026-07-23T18:13:57Z
---

## Description
Maintainer request 2026-07-23: a top-nav "Mentions" link + page showing every @mention
of the user across ALL projects, so agent handoffs addressed to them (the KIT-T130
comment loop in reverse — agents @mention the user too) are one click away instead of
buried per-ticket. Identity comes from KIT-T145's /api/me — depends on it, never a
name literal.

## Acceptance Criteria
- [ ] API: GET /api/mentions (agent defaults to the /api/me alias) — cross-project scan via comments.mjs surfacing; returns project, ticket ref, comment excerpt, author, timestamp, unread state. POST ack per mention (t ack path) + ack-all
- [ ] UI: top-nav Mentions link with live unread-count badge
- [ ] /mentions page: grouped by project, unread first, click-through to the ticket detail anchored at the comment, per-mention ack + mark-all-read
- [ ] Acked mentions stop counting in the badge and sink below unread (round-trip test at the API level)
- [ ] ui build + full npm test green

## Plan
1. Cross-project mentions service + routes (after KIT-T145 resolver exists).
2. Nav badge (poll or fetch-on-nav) + /mentions page.
3. Round-trip tests; ui:build for the live server.

## History
- [2026-07-23 18:13] (created) feature — Mentions page + top-nav link with unread badge — cross-project mentions of the resolved user, ack from the UI
