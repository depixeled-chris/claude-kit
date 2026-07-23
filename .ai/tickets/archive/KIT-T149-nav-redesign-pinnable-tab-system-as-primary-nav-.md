---
id: KIT-T149
title: Nav redesign — pinnable tab system as primary nav; secondary nav with dropdowns (project selector, settings) to start
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132, KIT-T144, KIT-T146]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:17:33Z
updated: 2026-07-23T18:48:58Z
---

## Description
Maintainer request 2026-07-23: replace the flat link nav with (1) a PRIMARY nav that
is a tab system — open views as tabs that can be PINNED (pinned tabs persist across
sessions via localStorage; unpinned tabs are transient); and (2) a SECONDARY nav row
with dropdowns, starting with a project selector (jump to any /p/:key — replaces the
growing per-project link chips) and a settings dropdown. Settings starts minimal:
show the resolved user identity (/api/me, KIT-T145) and a placeholder structure that
later settings (theme, defaults) can slot into — no speculative options.
Sequencing: ships AFTER KIT-T145 (identity for the settings display) and BEFORE
KIT-T146 (the Mentions link + unread badge becomes a first-class element of this nav).

## Acceptance Criteria
- [x] Primary nav renders open views as tabs (Waiting, All, visited project boards); a tab can be pinned/unpinned; pinned tabs persist (localStorage) and survive reload; unpinned close
- [x] Secondary nav: project-selector dropdown listing every project (name (KEY), review-count badge) navigating to /p/:key; settings dropdown showing the resolved identity from /api/me
- [x] Current route is visibly the active tab; deep links still work (a direct /p/:key visit materializes its tab)
- [x] Keyboard + click-outside behavior on dropdowns (Esc closes, focus returns)
- [x] ui build + full npm test green

## Plan
1. Nav shell: TabBar + SecondaryNav components, pin store (localStorage).
2. Project selector + settings dropdowns (identity via /api/me).
3. Route→tab materialization; migrate existing links; ui:build.

## History
- [2026-07-23 18:17] (created) feature — Nav redesign — pinnable tab system as primary nav; secondary nav with dropdowns (project selector, settings) to start
- [2026-07-23 18:42] (status) todo → doing
- [2026-07-23 18:48] (comment) ticked: Primary nav renders open views as tabs (Waiting, All, visited project boards); a tab can be pinned/unpinned; pinned tabs persist (localStorage) and survive reload; unpinned close
- [2026-07-23 18:48] (comment) ticked: Secondary nav: project-selector dropdown listing every project (name (KEY), review-count badge) navigating to /p/:key; settings dropdown showing the resolved identity from /api/me
- [2026-07-23 18:48] (comment) ticked: Current route is visibly the active tab; deep links still work (a direct /p/:key visit materializes its tab)
- [2026-07-23 18:48] (comment) ticked: Keyboard + click-outside behavior on dropdowns (Esc closes, focus returns)
- [2026-07-23 18:48] (comment) ticked: ui build + full npm test green
- [2026-07-23 18:48] (comment) @claude: Evidence: cd ui && npm run build green (tsc -b + vite, 76 modules — the new nav/ components). Root npm test EXIT=0 (serv (full comment #1 in ## Notes)
### comment #1 [2026-07-23 18:48] @claude
Evidence: cd ui && npm run build green (tsc -b + vite, 76 modules — the new nav/ components). Root npm test EXIT=0 (server suites 10/10 + 18/18, fail 0 across the chain). New atomic nav under ui/src/components/nav/: NavBar, TabBar (+ useTabs/pinnedStore for localStorage pins), Dropdown (Esc closes + returns focus to trigger, mousedown-outside closes), ProjectSelector, SettingsMenu (identity via /api/me), SecondaryNav. Old flat Nav.tsx/Nav.css removed; App.tsx mounts NavBar.
- [2026-07-23 18:48] (status) doing → done
