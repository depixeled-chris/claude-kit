---
id: KIT-T132
title: Web UI — cross-project review board, ticket detail with activity stream, comment + accept actions
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T129, KIT-T131, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:31Z
updated: 2026-07-23T16:56:24Z
---

## Description
The UI half of KIT-T129, per KIT-D044: a React 19 + Vite client (`ui/` in the kit)
against the KIT-T131 API. Screens: (1) landing = the cross-project WAITING-ON-YOU
review board — the clickable /prime; (2) per-project kanban by status with filters;
(3) ticket detail — frontmatter, AC checkboxes, a time-merged activity stream (History
events + comments, the workflow activity-merge idea), comment box with @mention,
accept/close + status controls honoring each project's human_only/uat config. Lift
from D:\dev\workflow: Modal.tsx (as-is), the {data,meta} fetch wrapper, kanban column
layout, relative-time formatter. Do NOT copy its types — write ours from the real API
DTOs, one casing (camelCase) end-to-end (the harvest's live-bug lesson).

## Acceptance Criteria
- [x] Landing board lists review-parked work across all projects, linking into detail
- [x] Ticket detail renders description, AC, and the time-merged activity stream (History + comments)
- [x] Comment form posts via the API and re-renders showing the durable comment; @mention works
- [x] Accept/close + status controls present, honoring per-project human_only/uat config
- [x] Types match API DTOs exactly — camelCase end-to-end, no snake_case remnants
- [x] `npm run dev` serves the client (Vite proxy → localhost API); `npm run build` (tsc) passes

## Plan
1. ui/ scaffold (Vite + React 19 + router), lift Modal + fetch wrapper + formatters.
2. Board + kanban screens over /api/waiting + /api/projects.
3. Detail screen: activity merge, comment form, status controls; build green.

## History
- [2026-07-23 15:15] (created) feature — Web UI — cross-project review board, ticket detail with activity stream, comment + accept actions
- [2026-07-23 16:40] (status) todo → doing
- [2026-07-23 16:54] (comment) @chris: UI round-trip check from curl � @claude ping
- [2026-07-23 16:55] (comment) ticked: Landing board lists review-parked work across all projects, linking into detail
- [2026-07-23 16:55] (comment) ticked: Ticket detail renders description, AC, and the time-merged activity stream (History + comments)
- [2026-07-23 16:55] (comment) ticked: Comment form posts via the API and re-renders showing the durable comment; @mention works
- [2026-07-23 16:55] (comment) ticked: Accept/close + status controls present, honoring per-project human_only/uat config
- [2026-07-23 16:55] (comment) ticked: Types match API DTOs exactly — camelCase end-to-end, no snake_case remnants
- [2026-07-23 16:55] (comment) ticked: `npm run dev` serves the client (Vite proxy → localhost API); `npm run build` (tsc) passes
- [2026-07-23 16:56] (comment) @claude: Build gate GREEN: ui/ npm run build (tsc -b && vite build) — 58 modules transformed, dist emitted. Repo npm test: 12/12  (full comment #2 in ## Notes)
### comment #2 [2026-07-23 16:56] @claude
Build gate GREEN: ui/ npm run build (tsc -b && vite build) — 58 modules transformed, dist emitted. Repo npm test: 12/12 API route tests pass (comment round-trip, 403 human_only, 422 evidence-floor, waiting board), survey 15/15, q 13/13 — no regressions. Live: API on 127.0.0.1:4319 + Vite on localhost:5173 (dev proxy /api verified forwarding); comment POST round-trip proven durable via curl (KIT-T132#1, mentions=[claude], unread for agent=claude on re-fetch).
- [2026-07-23 16:56] (status) doing → done
