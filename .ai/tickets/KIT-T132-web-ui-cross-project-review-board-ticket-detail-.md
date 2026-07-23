---
id: KIT-T132
title: Web UI — cross-project review board, ticket detail with activity stream, comment + accept actions
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T129, KIT-T131, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:31Z
updated: 2026-07-23T15:15:31Z
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
- [ ] Landing board lists review-parked work across all projects, linking into detail
- [ ] Ticket detail renders description, AC, and the time-merged activity stream (History + comments)
- [ ] Comment form posts via the API and re-renders showing the durable comment; @mention works
- [ ] Accept/close + status controls present, honoring per-project human_only/uat config
- [ ] Types match API DTOs exactly — camelCase end-to-end, no snake_case remnants
- [ ] `npm run dev` serves the client (Vite proxy → localhost API); `npm run build` (tsc) passes

## Plan
1. ui/ scaffold (Vite + React 19 + router), lift Modal + fetch wrapper + formatters.
2. Board + kanban screens over /api/waiting + /api/projects.
3. Detail screen: activity merge, comment form, status controls; build green.

## History
- [2026-07-23 15:15] (created) feature — Web UI — cross-project review board, ticket detail with activity stream, comment + accept actions
