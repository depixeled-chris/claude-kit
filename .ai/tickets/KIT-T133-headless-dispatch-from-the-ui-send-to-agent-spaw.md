---
id: KIT-T133
title: Headless dispatch from the UI — 'send to agent' spawns a guarded claude -p run on a comment (phase 2)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:31Z
updated: 2026-07-23T15:15:31Z
---

## Description
Phase 2 of KIT-T129 — explicitly deferred out of phase 1 by KIT-D044. A "send to
agent" action in the UI: the server spawns a headless `claude -p` run on the comment's
project so a response is handled without any live session. Requires guardrails
DESIGNED FIRST: concurrency cap, per-run cost budget, permission mode, audit trail
(.ai/agents.jsonl row per dispatch), and a visible run status in the UI. Blocked by
KIT-T130 (comment primitive) + KIT-T131 (API).

## Acceptance Criteria
- [ ] Guardrail design recorded (DECISIONS): concurrency, cost ceiling, permission mode, failure surfacing
- [ ] POST /api/dispatch spawns a headless run scoped to the comment's project and records it in agents.jsonl
- [ ] UI shows dispatch status (running/done/failed) on the ticket
- [ ] Runaway protection test-covered (cap + timeout)

## Plan
1. Design pass → DECISIONS entry (after T130/T131 land).

## History
- [2026-07-23 15:15] (created) feature — Headless dispatch from the UI — 'send to agent' spawns a guarded claude -p run on a comment (phase 2)
