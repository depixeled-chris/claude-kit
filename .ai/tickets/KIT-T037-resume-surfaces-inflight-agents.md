---
id: KIT-T037
title: "Programmatic resume omits in-flight background agents — make live work visible AND durable"
type: bug
status: todo
priority: high
milestone:
labels: [resume, orient, cache, agents, durability]
links: [KIT-T028, KIT-T035, KIT-T031, KIT-T026]
aka: []
files:
  - hooks/orient.mjs
  - scripts/hydrate-db.mjs
  - scripts/q.mjs
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Description
After `/clear`/compact, a fresh context has no programmatic way to see a background
subagent that is still running or that finished with uncommitted work. `orient.mjs`
surfaces commits, working-tree, roadmap, decisions, and open tickets — but not live agents;
`TaskList` returns empty in the new context. Only hand-written `SESSION.md` records the
agent, which produced a false "work is lost" conclusion in a real session (HOD, 2026-06-05).
Root cause: write -> hydrate -> read has no stage that writes live background-agent state
into the cache, so resume has nothing programmatic to read.

Decision (maintainer, 2026-06-05): fix BOTH dimensions — visible + durable.

## Acceptance criteria
- [ ] Live-agent state (id, label, status, output-file path, scope/guard, owning ticket) is
      hydrated into the cache as part of the normal hydrate step.
- [ ] `orient.mjs` adds an "In-flight / recently-completed agents" section read from the
      cache, so a post-`/clear` resume sees them without reading `SESSION.md` prose.
- [ ] Background agents commit-on-completion to their own worktree branch (durable, pushable)
      so finished work is never a lose-able uncommitted handoff; orchestrator reviews + merges.
- [ ] Stale entries age out (completed + merged agents drop from the in-flight view).
- [ ] Test: simulate a cleared context with a live agent registered; assert orient renders it.

## Notes
- Cap: `.ai/inbox/2026-06-05-resume-omits-inflight-agents.md`.
- Adjacent: KIT-T028 (mandatory agent status updates) likely supplies the write side;
  KIT-T035/T031/T026 own the cache plumbing this reads from.
