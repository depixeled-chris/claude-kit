---
id: T-001
title: Scope-aware /prime — lazy default, "what needs me?" briefing, named deep-dive
type: feature
status: todo
priority: high
milestone:
labels: [prime, orient, multi-project]
links: [D-010]
files:
  - commands/prime.md
  - hooks/orient.mjs
  - hooks/lib.mjs
  - scripts/survey.mjs
  - scripts/test-hooks.mjs
created: 2026-06-03T12:00:00Z
updated: 2026-06-03T12:00:00Z
---

## Description

`/prime` is the catch-up command. It serves **two audiences with one tool**: it gets a
freshly-wiped Claude back to useful in one shot (hard context reset), and it reminds the
maintainer what's open after time away (memory fades slowly + unreliably). The morning
scenario is the bar: wake up, clear context, type one thing — **both** of us get up to speed.

Today `/prime` only reads the *current* project's notebook. This makes it scope-aware across
*all* tracked projects (claude-kit is itself a tracked project), without being expensive.

The behavior, settled in conversation 2026-06-03:

- **`/prime` (no project named) — lazy on depth, thorough on "what needs me?"**
  It does NOT deep-dive every project. It detects the project actually in play (the folder
  the session was opened in is the primary signal) and catches up on *that* one. The one part
  it does thoroughly: a **cross-project list of what's OPEN**, with items **waiting on the
  maintainer** (decisions to make, tickets in `review`, work blocked-on-you) pulled to the top.
  Other projects get a one-line status nudge, not a full read.
- **`/prime <project> [project…]` — deep resume** of the named project(s), regardless of the
  current folder.
- The output reads like a **human briefing** (done / in-flight / waiting-on-you), not a raw
  dump — that's what makes it work for the maintainer, not just for Claude.

## Acceptance Criteria
<!-- Each must be a checkable observation. -->
- [ ] `/prime` with no argument produces a cross-project briefing whose FIRST section is
      "waiting on you" — decisions pending, tickets in `review`, blocked-on-maintainer items —
      aggregated across all tracked projects.
- [ ] The no-arg briefing is lazy: it deep-reads only the detected active project (session's
      folder), and lists other projects' open work as one-line status, not full detail.
- [ ] `/prime <project> [project…]` does a full resume (SESSION + active ticket + working-tree
      temperature) of each named project even when run from a different folder.
- [ ] The briefing is human-readable (a person skims it and knows their day); it is not a raw
      concatenation of note files.
- [ ] Each project's open work is read from the synced shared notebook; each project's git
      working-tree status (uncommitted + unpushed, incl. `watch_repos`) is included **when that
      project's repo is known on this machine**.
- [ ] A machine-local project→repo map fills itself in automatically whenever `orient` runs
      inside a tracked project. Projects not yet opened on this machine still appear in the
      briefing (notebook only), flagged "no local repo here."
- [ ] The machine-local map is NOT committed to the synced data repo (repo paths are
      machine-specific — Windows drive letters vs macOS paths).
- [ ] `npm test` covers the survey + the registry self-heal.

## Plan
<!-- filled in before editing; waits for OK if scope changes -->
1. `hooks/lib.mjs`: add `readRegistry()` + `recordProject(repoRoot, dataDir)` —
   read/write `~/.claude/claude-kit-projects.json` (`{ dataRoot, projects: {name: repoPath} }`).
2. `hooks/orient.mjs`: call `recordProject(...)` when it resolves the repo + data dir
   (self-heal). orient itself stays single-project at SessionStart (cheap).
3. `scripts/survey.mjs`: the engine. No args ⇒ "what needs me?" briefing (lazy, active project
   deep, others one-line). Named args ⇒ deep resume of those. Reads boards from synced data,
   git temperature from the locally-known repo path.
4. `commands/prime.md`: rewrite to drive the above — detect active project, default to the
   lazy briefing, deep-dive on named args.
5. `scripts/test-hooks.mjs`: assertions for survey + registry. Bump plugin version.

## Notes
<!-- append-only log -->
- 2026-06-03: Captured from a design conversation. Key reframings the maintainer drove:
  (1) `/prime` serves BOTH a wiped Claude and a faded-memory human — same tool, two audiences;
  (2) the no-arg default must be **lazy**, not a full sweep of every project — read the room
  (usually one project in play) and go deep there only;
  (3) the one thing the no-arg default must do thoroughly is surface **open items, especially
  those needing the maintainer's action**.
- Builds on [[D-010]] (git working-tree state is part of the tracked record; orient already
  surfaces per-project temperature incl. `watch_repos`).
- Surfaced while capturing: claude-kit's own notebook had ZERO tickets (template only) and an
  unfilled SESSION — its work had been logged under decisions + the game's (pilot) notebook.
  This is T-001, the first real claude-kit ticket; SESSION filled at the same time.
- Status stays `todo` pending the maintainer's go to build.
