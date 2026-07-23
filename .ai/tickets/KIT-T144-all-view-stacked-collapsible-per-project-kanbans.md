---
id: KIT-T144
title: All view — stacked collapsible per-project kanbans (Jira-style) at /all
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:06:55Z
updated: 2026-07-23T18:06:55Z
---

## Description
Maintainer request 2026-07-23: an "All" view — every project's kanban stacked
vertically on one page, each collapsible (Jira-style swimlane boards), so the whole
portfolio is scannable without hopping /p/:key pages. Requires extracting the kanban
column markup from ProjectBoard.tsx into a reusable component (it is currently
page-bound), then an /all page mapping projects → collapsible sections, collapsed
state remembered (localStorage) so big projects (HOD: 358 open) don't drown the page
on every visit.

## Acceptance Criteria
- [ ] Kanban board extracted from ProjectBoard.tsx into a reusable component; /p/:key renders identically (no visual regression in markup/classes)
- [ ] /all renders every project as a stacked section: tinted heading (project key/name + open/review counts), collapsible body containing that project's kanban
- [ ] Collapse state persists per project (localStorage); default = collapsed for projects with no review items, expanded otherwise
- [ ] Nav links to All; loading is per-section (a slow project doesn't block the rest)
- [ ] ui npm run build (tsc + vite) passes; repo npm test green

## Plan
1. Extract <KanbanBoard tickets=... projectKey=...> from ProjectBoard.tsx.
2. AllBoards page: fetch project list, per-section ticket fetch + collapse.
3. Nav entry, build gate, ui:build for the live single-port server.

## History
- [2026-07-23 18:06] (created) feature — All view — stacked collapsible per-project kanbans (Jira-style) at /all
