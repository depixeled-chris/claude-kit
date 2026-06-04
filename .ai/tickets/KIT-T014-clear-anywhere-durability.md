---
id: KIT-T014
title: Harden /clear-anywhere durability — surface in-flight agents + keep the resume anchor live
type: feature
status: todo
priority: high
milestone:
labels: [hooks, capture, orchestration, durability]
links: [KIT-D015, KIT-D002, KIT-T006]
files:
  - hooks/orient.mjs
  - hooks/flush.mjs
  - hooks/request-gate.mjs
created: 2026-06-04T11:25:00Z
updated: 2026-06-04T11:25:00Z
---

## Description
Make KIT-D015 ("/clear anywhere loses nothing") TRUE in practice. Today the orient hook replays
git + SESSION.md + decisions + lineage at SessionStart, request-gate captures accepted requests,
and commit-gate ties work to tickets — but two leaks let a mid-conversation `/clear` lose live
state:

1. **In-flight background subagents are invisible to a cold resume.** When the orchestrator
   delegates fixes to background agents (Agent run_in_background), nothing on disk records the
   roster (task, scope, handle). A `/clear` orphans that delegated work — the resumed context
   doesn't know it exists.
2. **The resume anchor (SESSION.md) goes stale between flushes.** It's only reliably written at
   PreCompact/Stop, so a `/clear` in the middle of active work resumes from a stale anchor.

## Acceptance Criteria
- [ ] Orient (SessionStart) surfaces in-flight + recently-finished background agents — task,
      scope, status — so a cold resume can reattach (e.g. via TaskList) or at least know the work.
- [ ] A durable on-disk roster of delegated agents exists (where the orchestrator records each
      delegation + its outcome), reconcilable on resume; orphaned/uncollected work is flagged.
- [ ] SESSION.md is treated as a live anchor: a Stop-time nudge fires if meaningful work happened
      this turn without SESSION.md being touched (mirrors the request-gate ratchet pattern).
- [ ] The capture→delegate→stay-free CADENCE is documented as a resume-restated mode, not
      in-context-only state.
- [ ] Automated test(s) for the new hook behavior (throwaway adopted repo, like request-gate.test.mjs).

## Plan
1.

## Notes
- 2026-06-04: Filed from a live session where 3 background fix-agents were in flight and the
  maintainer flagged that a /clear must not lose them. KIT-D015 records the pillar; this hardens it.
