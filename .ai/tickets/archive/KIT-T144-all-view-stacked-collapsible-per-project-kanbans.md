---
id: KIT-T144
title: All view — stacked collapsible per-project kanbans (Jira-style) at /all
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:06:55Z
updated: 2026-07-23T18:16:09Z
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
- [x] Kanban board extracted from ProjectBoard.tsx into a reusable component; /p/:key renders identically (no visual regression in markup/classes)
- [x] /all renders every project as a stacked section: tinted heading (project key/name + open/review counts), collapsible body containing that project's kanban
- [x] Collapse state persists per project (localStorage); default = collapsed for projects with no review items, expanded otherwise
- [x] Nav links to All; loading is per-section (a slow project doesn't block the rest)
- [x] ui npm run build (tsc + vite) passes; repo npm test green

## Plan
1. Extract <KanbanBoard tickets=... projectKey=...> from ProjectBoard.tsx.
2. AllBoards page: fetch project list, per-section ticket fetch + collapse.
3. Nav entry, build gate, ui:build for the live single-port server.

## History
- [2026-07-23 18:06] (created) feature — All view — stacked collapsible per-project kanbans (Jira-style) at /all
- [2026-07-23 18:08] (comment) @chris: Scope add from Chris mid-flight: board views must use the FULL viewport width — as the screen widens, swimlanes should w (full comment #1 in ## Notes)
### comment #1 [2026-07-23 18:08] @chris
Scope add from Chris mid-flight: board views must use the FULL viewport width — as the screen widens, swimlanes should widen/fit more. Do not restrict body max-width on kanban/board pages; this is a data-driven UI, not a brochure site. Apply to /p/:key and /all (detail pages may keep a readable max-width).
- [2026-07-23 18:08] (status) todo → doing
- [2026-07-23 18:08] (comment) @chris: Second scope add from Chris: expanded kanban section headings must show the full project NAME, not the shorthand key — e (full comment #2 in ## Notes)
### comment #2 [2026-07-23 18:08] @chris
Second scope add from Chris: expanded kanban section headings must show the full project NAME, not the shorthand key — e.g. 'hustle-or-die (HOD)', name first, prefix in parentheses. Shorthand alone is fine only where space is tight (collapsed chips/badges are ok).
- [2026-07-23 18:15] (comment) ticked: Kanban board extracted from ProjectBoard.tsx into a reusable component; /p/:key renders identically (no visual regression in markup/classes)
- [2026-07-23 18:15] (comment) ticked: /all renders every project as a stacked section: tinted heading (project key/name + open/review counts), collapsible body containing that project's kanban
- [2026-07-23 18:15] (comment) ticked: Collapse state persists per project (localStorage); default = collapsed for projects with no review items, expanded otherwise
- [2026-07-23 18:15] (comment) ticked: Nav links to All; loading is per-section (a slow project doesn't block the rest)
- [2026-07-23 18:15] (comment) ticked: ui npm run build (tsc + vite) passes; repo npm test green
- [2026-07-23 18:15] (comment) @claude: Evidence: cd ui && npm run build (tsc -b && vite build) green — 64 modules, built in 919ms, dist/assets/index-BeQyh1x0.j (full comment #3 in ## Notes)
### comment #3 [2026-07-23 18:15] @claude
Evidence: cd ui && npm run build (tsc -b && vite build) green — 64 modules, built in 919ms, dist/assets/index-BeQyh1x0.js. Repo npm test green — every suite 0 failed (t: 49, code-graph: 33, db-cache: 66, server API: 14 pass incl. SPA-fallback test, etc; 'All tests passed'). Live check: GET http://127.0.0.1:4319/all -> 200 text/html, root div + freshly-built bundle index-BeQyh1x0.js served (SPA fallback). Scope-add #1 (full-width boards): App.tsx isBoardRoute() applies .main--wide (max-width:none) to /all and /p/:key only; ticket detail + waiting keep the centered readable column. Scope-add #2 (full-name headings): ProjectSection heading renders name + (key) e.g. 'hustle-or-die (HOD)', shorthand key reserved for tight chips/badges. Kanban extracted to components/KanbanBoard.tsx — /p/:key markup/classes unchanged.
- [2026-07-23 18:16] (status) doing → done
