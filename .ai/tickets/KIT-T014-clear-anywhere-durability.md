---
id: KIT-T014
title: Harden /clear-anywhere durability — surface in-flight agents + keep the resume anchor live
type: feature
status: todo
priority: critical
milestone:
labels: [hooks, capture, orchestration, durability]
links: [KIT-D015, KIT-D002, KIT-T006]
files:
  - hooks/orient.mjs
  - hooks/flush.mjs
  - hooks/request-gate.mjs
created: 2026-06-04T11:25:00Z
updated: 2026-06-04T11:25:00Z
supersedes: KIT-T037
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
- [2026-06-05 20:16] (comment) folded from triage: # CAP: programmatic resume omits in-flight background agents

Date: 2026-06-05
Scope: KIT
Type: bug / architecture-gap
Related: KIT-T028 (mandatory-agent-status-updates), KIT-T035 (cache-staleness), KIT-T031 (cross-scope-cache-hydration), KIT-T026 (consume-the-cache)

## What happened
After `/clear` in hustle-or-die, a background subagent (`a55317e42f51677c0`, 3 sim
regressions) was still running and held uncommitted work it would later write to disk.
The programmatic resume could not see it:
- `orient.mjs` surfaces commits, working-tree (live `formatWip`), roadmap, decisions,
  and open *tickets* (from the cache) — but NOT live agents.
- `TaskList` returned empty in the fresh post-`/clear` context.
Only the hand-written `.ai/SESSION.md` recorded the agent — and it pointed the resumer at
`TaskList`, which returned nothing, producing a false "work is lost" conclusion.

## Root cause
The write -> hydrate -> read path has no stage that writes *live background-agent state*
(id, label, status, output-file, guard/scope, owning ticket) into the cache. So resume has
nothing programmatic to read; it depends on a human-maintained SESSION.md line.

## Why it matters
Resume-from-clear must be 100% programmatic (one hydrate, then read the cache). Any state a
resumer needs but that only exists in prose is a latent "is it lost?" incident. In-flight
agents are exactly such state.

## Candidate fixes (for triage)
1. Hydrate a live-agent registry into the cache; `orient.mjs` adds an "In-flight agents"
   section read from it. (Direct write->hydrate->read fix.)
2. Agents commit-on-completion to their own worktree branch, so completed work is never a
   lose-able uncommitted handoff (durability, not just visibility).
3. Flush-gate: refuse `/clear`/compact while agents are in-flight until collected.

Likely 1 + 2 together: 1 makes live work *visible* on resume, 2 makes finished work
*durable* without an orchestrator round-trip.
- 2026-06-04: Filed from a live session where 3 background fix-agents were in flight and the
  maintainer flagged that a /clear must not lose them. KIT-D015 records the pillar; this hardens it.
- 2026-06-04 PRIORITY high→critical: this is THE TRUST-ENABLER. Maintainer: "I need to be able to
  trust this process with /compact and /clear." Today the safety is partly MANUAL (the orchestrator
  keeps SESSION.md current by hand; orient doesn't auto-list in-flight agents) — so it's reliable
  only when the operator remembers. Trust requires the GUARANTEE: (1) Stop-nudge blocks ending a turn
  where real work happened but SESSION.md wasn't touched; (2) orient auto-surfaces in-flight +
  recently-finished agents (TaskList) every SessionStart; (3) a durable on-disk agent roster. Also
  add a RESUME DRILL (a test that simulates compact→resume and asserts zero loss) so trust is proven,
  not asserted. Until this lands, treat /clear as safe ONLY at a committed + SESSION-current checkpoint.
