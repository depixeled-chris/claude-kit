---
id: KIT-T137
title: Per-project settings page; editable display title defaulting to the prefix
type: feature
status: review
priority: high
milestone:
labels: [ui, web-ui, server]
aka: []
parent:
introduced_by:
produced_by:
informs: []
links: [KIT-D044, KIT-T131, KIT-T132]
files: [server/services/discovery.mjs, server/services/projects.mjs, server/services/writes.mjs, server/routes/projects.mjs, server/server.test.mjs, ui/src/pages/ProjectSettings.tsx, ui/src/components/Nav.tsx]
tier:
model:
effort:
supersedes:
superseded_by:
created: 2026-07-23T11:05:00Z
updated: 2026-07-23T11:05:00Z
---

## Description
Chris (2026-07-23, UAT): "So each project needs a settings page." and
"Project tab titles should also be editable. They should default to the
prefix, but they need to be editable. The prefixes are already confusing
with just a handful of projects."

One coherent feature: a `/p/:key/settings` page whose first setting is the
project display title. Persisted as top-level `display_name:` in the store's
`.ai/config.yml` (truth on disk, per KIT-D044's markdown/config-write
discipline), read live per request, defaulting to `ids.key` when absent.
Nav tabs and the settings page render the display title; the id prefix
remains the URL segment and id scheme.

## Acceptance Criteria
- [x] `GET /api/projects` rows carry `displayName`, defaulting to the key.
- [x] `PATCH /api/projects/:key {displayName}` writes `display_name:` into
      the store's config.yml (replace-or-append, no YAML dep) and the next
      read serves it; empty/oversized/quoted names rejected 400.
- [x] Nav tabs render the display title; they refresh after a save.
- [x] `/p/:key/settings` page: edit + save the title, linked from the board
      header; route stays a readable column (not full-bleed).
- [x] Route tests cover default, round-trip, and rejection.

## Plan
1. discovery.mjs: `readDisplayName(aiDir, fallback)` line-parse.
2. projects.mjs summaries + writes.mjs `setProjectDisplayName` + PATCH route.
3. UI: type + api client, Nav render + `kit:projects-changed` refresh event,
   ProjectSettings page + route + board-header link.
4. server.test.mjs: three route tests.

## Notes
Captured mid-turn during UAT (interjections while T136 was in flight);
folded into one ticket because the settings page without a first real
setting would be vapor.

## History
- [2026-07-23 11:05] (created) captured from UAT feedback (two interjections, one feature)
- [2026-07-23 11:22] (fixed) node --test server/server.test.mjs — 17 pass (3 new: default, durable round-trip, 400 rejections); ui `npm run build` clean
- [2026-07-23 11:22] (comment) commit carries scripts/identity.mjs (KIT-T145 in-flight leaf dep of writes.mjs) to keep main buildable; rest of the T145 wave left uncommitted for its own session
- [2026-07-23 11:22] (status) doing → review — settings page look/behavior is Chris's UAT
- [2026-07-23 11:42] (comment) UAT crash: blank /p/HOD/settings — dist built from the dirty shared tree called /api/me (404 on the stale server process) and the page did displayName.trim() with the field absent (version skew). Fixed: displayName ?? key fallback; dist rebuilt; :4319 server restarted; GET /api/projects now serves displayName for all 8 projects
