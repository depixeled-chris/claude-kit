---
id: KIT-T131
title: REST API hub server — cache-read/markdown-write over every adopted project (localhost)
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T129, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:31Z
updated: 2026-07-23T15:15:31Z
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
- [ ] GET /api/projects lists every adopted project (registry + central notebooks)
- [ ] GET /api/projects/:key/tickets (?status= filter) + /tickets/:id (frontmatter + body: description, AC, Notes, History) + list endpoints for questions/decisions/inbox — all served from the SQLite cache with staleness verify→rehydrate
- [ ] POST /tickets/:id/comments and POST /tickets/:id/status write through t.mjs code paths to markdown (guards intact), regen views; an immediate GET reflects the write (bidirectional round-trip test)
- [ ] GET /api/waiting returns the cross-project WAITING-ON-YOU board (survey.mjs data)
- [ ] Server binds 127.0.0.1 only; {data,meta} envelope; central error handler; camelCase DTOs
- [ ] Route-level tests against a fixture project store (node --test)

## Plan
1. server/ scaffold: express app, registry discovery service, error/envelope middleware.
2. Read routes over q.mjs surfaces; waiting board over survey.mjs.
3. Write routes over t.mjs + KIT-T130 comment verb; round-trip tests.

## History
- [2026-07-23 15:15] (created) feature — REST API hub server — cache-read/markdown-write over every adopted project (localhost)
