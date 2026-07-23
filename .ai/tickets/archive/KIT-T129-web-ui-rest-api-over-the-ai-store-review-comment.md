---
id: KIT-T129
title: Web UI + REST API over the .ai store — review/comment loop without burning session context
type: epic
status: done
priority: medium
milestone: M4-web-ui
labels: []
links: [KIT-T130, KIT-T131, KIT-T132, KIT-T133, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:08:42Z
updated: 2026-07-23T16:58:51Z
---

## Description
Claude-kit borrowed the workflow concepts from D:\dev\workflow but left its UI and API
behind. The maintainer cannot keep up with tickets parked in `review` awaiting
acceptance (11 in KIT alone; far more across GG/HOD/etc.), and today commenting on one
means dropping it into an active session — token-expensive, context-heavy. Wanted: a
local web UI + REST API over the .ai/ store so the maintainer can browse review-parked
work, comment, and accept/close from a browser. Comments land as durable ticket
artifacts (History comment events / Notes) so a tabula-rasa agent picks them up via
drain and handles them without rebuilding a session context.

Harvest source: D:\dev\workflow — client (React 19 + Vite + react-router), server
(Express + better-sqlite3). Lift what generalizes; the .ai/ markdown files stay the
truth (API reads via the existing db cache, writes via the same code paths as the `t`
CLI so gates and view regeneration stay consistent).

## Acceptance Criteria
- [x] REST API over the .ai store: list/detail for tickets, questions, decisions, inbox; write surface for comments and status transitions — markdown files remain the truth, writes go through the t-CLI code paths
- [x] Web UI: review board (tickets parked in review, cross-project or per-project per design decision), ticket detail rendering Notes/History, comment box, accept/close action
- [x] A comment posted in the UI lands in the ticket file as a durable History/Notes entry that `/drain` or a fresh agent surfaces and acts on without maintainer re-prompting
- [x] Harvest verdict recorded in DECISIONS: what was lifted from D:\dev\workflow vs rebuilt vs left behind
- [x] Child tickets cut for the implementation slices once the design decisions land

## Plan
1. Researcher sweep of D:\dev\workflow client/server (running).
2. Design decisions via questionnaire: scope (per-repo vs cross-project hub), stack reuse, where it lives in the kit.
3. Cut child tickets per the accepted design; this epic tracks the arc.

## Notes
Harvest verdict (researcher sweep of D:\dev\workflow, 2026-07-23):
- ARCHITECTURAL INVERSION: workflow is DB-as-truth (Prisma/SQLite authoritative; its
  work/ markdown is a dead byproduct, never read/written by the server). claude-kit is
  markdown-as-truth + SQLite read cache. The store layer does NOT transfer — what
  transfers is the UI skeletons, the API/DTO conventions, and the comment pattern.
- HIGHEST-VALUE LIFT: the comment → @mention → read-receipt pull pattern
  (server/src/services/comments.service.ts + utils/mentions.ts): human posts a comment,
  @mentions are derived on read via /@([\w-]+)/g, agents pull GET
  /api/mentions/:agent/unread at task start and ack via a MentionRead upsert. A pull-
  based, mention-addressed inbox — exactly the "human comments, tabula-rasa agent picks
  it up" primitive. Re-back it with .ai/ markdown (comment in ticket History/Notes +
  per-agent seen marker), not tables.
- ALSO LIFT: Modal.tsx (generic, portal-based, zero coupling); the {data,meta} fetch-
  wrapper convention (client/src/services/api.ts:29-56); thin
  route→service→asyncHandler→errorHandler layering; activity-stream merge idea
  (activity.service.ts — comments/worklogs/decisions/blockers merged time-sorted);
  kanban column layout + relative-time formatter (TaskBoard.tsx:55-67).
- ADAPT, DON'T COPY: the 3 pages (Dashboard/TaskBoard/TaskDetail) are good skeletons
  but carry a live client↔server casing mismatch (client snake_case types vs camelCase
  DTOs — UI reads fields the API never emits) and a Dashboard stats type bug.
  Regenerate types from our real API; pick one casing.
- LEAVE BEHIND: Prisma + the half-applied projects/int-PK migration (schema says int
  PK + projectId; services/DTOs/committed data still string-PK, no projects table —
  known rot); unused better-sqlite3 dep; the agent-orchestration CLI + work/ archive +
  cycle-log machinery (stock-strategy-specific); docker/cron/nginx infra.
  REFACTOR_PLAN.md + 009 decisions doc describe an architecture never built (SCSS
  Modules/Redux/Axios/nginx, all steps checked ✅) — aspirational, not descriptive.
- Server had zero auth and wide-open CORS; auth was roadmap-only there.
### comment #1 [2026-07-23 16:58] @claude
Phase 1 shipped: KIT-T130 2ae4bc2 (comments 35 passed, t 49 passed), KIT-T131 eb3d727 (API 12/12, live-verified /api/waiting + 8 projects), KIT-T132 f093e7c (ui/ tsc+vite build green 987ms, comment round-trip proven via POST->refetch). Full suite npm test EXIT=0. Phase 2 (headless dispatch) tracked as KIT-T133.

## History
- [2026-07-23 15:08] (created) epic — Web UI + REST API over the .ai store — review/comment loop without burning session context
- [2026-07-23 15:18] (comment) ticked: Harvest verdict recorded in DECISIONS: what was lifted from D:\dev\workflow vs rebuilt vs left behind
- [2026-07-23 15:18] (comment) ticked: Child tickets cut for the implementation slices once the design decisions land
- [2026-07-23 16:58] (comment) ticked: REST API over the .ai store: list/detail for tickets, questions, decisions, inbox; write surface for comments and status transitions — markdown files remain the truth, writes go through the t-CLI code paths
- [2026-07-23 16:58] (comment) ticked: Web UI: review board (tickets parked in review, cross-project or per-project per design decision), ticket detail rendering Notes/History, comment box, accept/close action
- [2026-07-23 16:58] (comment) ticked: A comment posted in the UI lands in the ticket file as a durable History/Notes entry that `/drain` or a fresh agent surfaces and acts on without maintainer re-prompting
- [2026-07-23 16:58] (comment) @claude: Phase 1 shipped: KIT-T130 2ae4bc2 (comments 35 passed, t 49 passed), KIT-T131 eb3d727 (API 12/12, live-verified /api/wai (full comment #1 in ## Notes)
- [2026-07-23 16:58] (status) todo → done
