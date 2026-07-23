---
id: KIT-T131
title: REST API hub server — cache-read/markdown-write over every adopted project (localhost)
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T129, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:31Z
updated: 2026-07-23T16:37:11Z
---

## Description
The API half of KIT-T129, per KIT-D044: an Express server (`server/` in the kit) over
EVERY adopted project — discovery via the machine registry + claude-kit-data central
notebooks (the survey.mjs path; note KIT-T134 — central store currently missing most
projects). Data flow is cache-READ / markdown-WRITE, bidirectional: reads served from
the per-project SQLite FTS5 cache through the q.mjs surfaces (verifyCache staleness →
rehydrate); writes call the t.mjs functions (setStatus with evidence-floor + human_only
guards intact, tick, link, comment from KIT-T130) landing in the markdown truth, then
view regen — the cache picks the write up on the next read. The API never writes the
cache directly. Harvested conventions: {data,meta} envelope, thin
route→service→asyncHandler→errorHandler layering. Binds 127.0.0.1 only; CORS scoped to
the Vite dev client. camelCase DTOs end-to-end (the workflow casing-mismatch lesson).

## Acceptance Criteria
- [x] GET /api/projects lists every adopted project (registry + central notebooks)
- [x] GET /api/projects/:key/tickets (?status= filter) + /tickets/:id (frontmatter + body: description, AC, Notes, History) + list endpoints for questions/decisions/inbox — all served from the SQLite cache with staleness verify→rehydrate
- [x] POST /tickets/:id/comments and POST /tickets/:id/status write through t.mjs code paths to markdown (guards intact), regen views; an immediate GET reflects the write (bidirectional round-trip test)
- [x] GET /api/waiting returns the cross-project WAITING-ON-YOU board (survey.mjs data)
- [x] Server binds 127.0.0.1 only; {data,meta} envelope; central error handler; camelCase DTOs
- [x] Route-level tests against a fixture project store (node --test)

## Plan
1. server/ scaffold: express app, registry discovery service, error/envelope middleware.
2. Read routes over q.mjs surfaces; waiting board over survey.mjs.
3. Write routes over t.mjs + KIT-T130 comment verb; round-trip tests.

## History
- [2026-07-23 15:15] (created) feature — REST API hub server — cache-read/markdown-write over every adopted project (localhost)
- [2026-07-23 16:09] (status) todo → doing
- [2026-07-23 16:36] (comment) ticked: GET /api/projects lists every adopted project (registry + central notebooks)
- [2026-07-23 16:36] (comment) ticked: GET /api/projects/:key/tickets (?status= filter) + /tickets/:id (frontmatter + body: description, AC, Notes, History) + list endpoints for questions/decisions/inbox — all served from the SQLite cache with staleness verify→rehydrate
- [2026-07-23 16:36] (comment) ticked: POST /tickets/:id/comments and POST /tickets/:id/status write through t.mjs code paths to markdown (guards intact), regen views; an immediate GET reflects the write (bidirectional round-trip test)
- [2026-07-23 16:36] (comment) ticked: GET /api/waiting returns the cross-project WAITING-ON-YOU board (survey.mjs data)
- [2026-07-23 16:36] (comment) ticked: Server binds 127.0.0.1 only; {data,meta} envelope; central error handler; camelCase DTOs
- [2026-07-23 16:36] (comment) ticked: Route-level tests against a fixture project store (node --test)
- [2026-07-23 16:37] (comment) @claude: Tests: server/server.test.mjs 12/12 pass (node --test) — list/detail reads, comment POST bidirectional round-trip, human (full comment #1 in ## Notes)
### comment #1 [2026-07-23 16:37] @claude
Tests: server/server.test.mjs 12/12 pass (node --test) — list/detail reads, comment POST bidirectional round-trip, human_only 403 + evidence-floor 422 guard rejections, 127.0.0.1 bind. Full npm test suite green (exit 0). Live curl round-trip on 127.0.0.1:4319 confirmed 8 adopted projects with counts, KIT-T131 detail cached:true, /api/waiting 6 entries, 404 mapping.
- [2026-07-23 16:37] (status) doing → done
