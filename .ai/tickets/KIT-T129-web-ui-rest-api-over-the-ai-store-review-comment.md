---
id: KIT-T129
title: Web UI + REST API over the .ai store — review/comment loop without burning session context
type: epic
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:08:42Z
updated: 2026-07-23T15:08:42Z
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
- [ ] REST API over the .ai store: list/detail for tickets, questions, decisions, inbox; write surface for comments and status transitions — markdown files remain the truth, writes go through the t-CLI code paths
- [ ] Web UI: review board (tickets parked in review, cross-project or per-project per design decision), ticket detail rendering Notes/History, comment box, accept/close action
- [ ] A comment posted in the UI lands in the ticket file as a durable History/Notes entry that `/drain` or a fresh agent surfaces and acts on without maintainer re-prompting
- [ ] Harvest verdict recorded in DECISIONS: what was lifted from D:\dev\workflow vs rebuilt vs left behind
- [ ] Child tickets cut for the implementation slices once the design decisions land

## Plan
1. Researcher sweep of D:\dev\workflow client/server (running).
2. Design decisions via questionnaire: scope (per-repo vs cross-project hub), stack reuse, where it lives in the kit.
3. Cut child tickets per the accepted design; this epic tracks the arc.

## History
- [2026-07-23 15:08] (created) epic — Web UI + REST API over the .ai store — review/comment loop without burning session context
