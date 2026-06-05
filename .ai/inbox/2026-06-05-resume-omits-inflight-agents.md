# CAP: programmatic resume omits in-flight background agents

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
