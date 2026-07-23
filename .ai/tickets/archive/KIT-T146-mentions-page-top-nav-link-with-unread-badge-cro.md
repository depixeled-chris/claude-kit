---
id: KIT-T146
title: Mentions page + top-nav link with unread badge — cross-project mentions of the resolved user, ack from the UI
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T145, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:13:57Z
updated: 2026-07-23T19:01:20Z
---

## Description
Maintainer request 2026-07-23: a top-nav "Mentions" link + page showing every @mention
of the user across ALL projects, so agent handoffs addressed to them (the KIT-T130
comment loop in reverse — agents @mention the user too) are one click away instead of
buried per-ticket. Identity comes from KIT-T145's /api/me — depends on it, never a
name literal.

## Acceptance Criteria
- [x] API: GET /api/mentions (agent defaults to the /api/me alias) — cross-project scan via comments.mjs surfacing; returns project, ticket ref, comment excerpt, author, timestamp, unread state. POST ack per mention (t ack path) + ack-all
- [x] UI: top-nav Mentions link with live unread-count badge
- [x] /mentions page: grouped by project, unread first, click-through to the ticket detail anchored at the comment, per-mention ack + mark-all-read
- [x] Acked mentions stop counting in the badge and sink below unread (round-trip test at the API level)
- [x] ui build + full npm test green

## Plan
1. Cross-project mentions service + routes (after KIT-T145 resolver exists).
2. Nav badge (poll or fetch-on-nav) + /mentions page.
3. Round-trip tests; ui:build for the live server.

## History
- [2026-07-23 18:13] (created) feature — Mentions page + top-nav link with unread badge — cross-project mentions of the resolved user, ack from the UI
- [2026-07-23 18:50] (status) todo → doing
- [2026-07-23 19:01] (comment) ticked: API: GET /api/mentions (agent defaults to the /api/me alias) — cross-project scan via comments.mjs surfacing; returns project, ticket ref, comment excerpt, author, timestamp, unread state. POST ack per mention (t ack path) + ack-all
- [2026-07-23 19:01] (comment) ticked: UI: top-nav Mentions link with live unread-count badge
- [2026-07-23 19:01] (comment) ticked: /mentions page: grouped by project, unread first, click-through to the ticket detail anchored at the comment, per-mention ack + mark-all-read
- [2026-07-23 19:01] (comment) ticked: Acked mentions stop counting in the badge and sink below unread (round-trip test at the API level)
- [2026-07-23 19:01] (comment) ticked: ui build + full npm test green
- [2026-07-23 19:01] (comment) @claude: Evidence: server/server.test.mjs 20/20 incl. two mention round-trips (mention→unread→ack→unreadCount 0 + sinks below; ac (full comment #1 in ## Notes)
### comment #1 [2026-07-23 19:01] @claude
Evidence: server/server.test.mjs 20/20 incl. two mention round-trips (mention→unread→ack→unreadCount 0 + sinks below; ack-all clears remainder). Full npm test EXIT=0 (db-cache 66/66, identity 6/6). cd ui && npm run build green (80 modules). Backend: server/services/mentions.mjs (cross-project collectItems + comments.mentionsForAgent scan) + routes/mentions.mjs (GET /api/mentions, POST /ack, /ack-all), agent defaults to resolveUser(). UI: MentionsTab base tab w/ live unread badge (useUnreadMentions, refetch on MENTIONS_CHANGED_EVENT + focus), /mentions page grouped by project (unread first) with per-mention + mark-all-read acks; click-through anchors to #comment-N (ActivityStream id + TicketDetail scroll/flash). Note: transient db-cache 7-fail on first full run was shared-cache contention with a parallel session; clean on isolated + re-run.
- [2026-07-23 19:01] (status) doing → done
