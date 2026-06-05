# CAP: deployed hooks drift from the claude-kit source — single owning source must run

Date: 2026-06-05
Scope: KIT
Type: bug / hygiene
Related: KIT-T037 (resume), the orient/hydrate machinery

## Directive (maintainer, 2026-06-05, verbatim intent)
"There should be no project hooks — we own the claude-kit plugin and the repo that drives it."
The resume/orient/cache machinery is OURS in claude-kit; nothing should depend on stale per-machine
deployed copies, and I should reason from the repo source, never from `~/.claude/hooks/` copies.

## Evidence of the drift
During the HOD resume incident I catted the deployed `~/.claude/hooks/orient.mjs` and it was an
OLDER, simpler version (commits + SESSION head only) than `claude-kit/hooks/orient.mjs` (which has
the live `formatWip` working-tree section + the cache `query` open-work section). The rich orient
that ACTUALLY ran matches the repo source, not the deployed copy. So the deployed `~/.claude/hooks/`
copies are stale/vestigial relative to the source that drives behavior.

## Why it matters
A stale deployed hook that still gets invoked in some contexts makes resume nondeterministic — the
exact failure class that produced the "is the work lost?" confusion. The plugin/repo must be the
SINGLE source that executes; deployed copies must either be kept in lockstep by install/sync, or
removed so only the plugin runs.

## To decide on triage
- Confirm which orient actually executes (plugin path vs `~/.claude/hooks/` deployed copy).
- Make the claude-kit plugin/repo the sole runtime source; kill or auto-sync the deployed copies.
- Add a check that flags deployed-vs-source hook drift (so this can't silently rot again).
