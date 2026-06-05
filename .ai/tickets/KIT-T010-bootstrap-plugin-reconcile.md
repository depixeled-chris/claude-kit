---
id: KIT-T010
title: Reconcile bootstrap.sh vs plugin — plugin owns tooling, bootstrap owns CLAUDE.md+overlay
type: bug
status: review
priority: high
milestone:
labels: [install, bootstrap, plugin, docs]
links: [KIT-D013, KIT-D001, KIT-D002]
files:
  - bootstrap.sh
  - README.md
  - .ai/decisions/KIT-D013.md
created: 2026-06-03T22:45:00Z
updated: 2026-06-03T22:45:00Z
---

## Description
claude-kit shipped two install mechanisms that both installed the SAME public tooling:
the **plugin** (auto-wires hooks via `hooks/hooks.json`) AND `bootstrap.sh` (symlinks
commands/hooks/skills/agents into `~/.claude`). bootstrap had zero plugin-awareness, and the
decision-of-record (KIT-D001) still called bootstrap canonical while the README/plugin.json
called the plugin canonical. On a machine with both, hooks fire twice and commands appear
twice — which confused a second machine's Claude (surfaced 2026-06-03). Maintainer call:
"you make the call" + "make it clear in the README so this doesn't happen again."

## Acceptance Criteria
- [x] `bootstrap.sh` defaults to overlay-only: composes `~/.claude/CLAUDE.md` + links the
      private overlay + statusline; does NOT symlink the public tooling.
- [x] `LINK_TOOLING=1` restores the legacy full symlink install for non-plugin machines,
      with a loud "never run alongside the plugin" warning.
- [x] `bootstrap.sh` output states which mode it's in and what it did/skipped.
- [x] KIT-D013 records the decision; KIT-D001 annotated as reconciled.
- [x] README has an unambiguous "Install — two mechanisms, one rule" section (a table of
      what each mechanism installs + the "install tooling once, never both" rule).

## Plan
Done — see History.

## Notes
- [2026-06-05 20:16] (comment) folded from triage: # CAP: deployed hooks drift from the claude-kit source — single owning source must run

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
- [2026-06-05 20:16] (comment) folded from triage: Make ~/.claude a fully DERIVED install end-to-end: run bootstrap to symlink commands/skills/agents (needs WSL on native Windows — currently hooks were hand-copied). (Done 2026-06-02: global CLAUDE.md split into public base user-config/CLAUDE.global.md + private overlay ~/.claude/private/CLAUDE.md and composed live; all 8 hooks are Node + wired; legacy bash deleted.)
- [2026-06-05 20:16] (comment) folded from triage: Expand README + STRATEGY: kit is source-of-truth for ALL tooling + a research KB + an agent library, not just the workflow.
- 2026-06-03: Triaged from inbox capture `2026-06-03-2245-bootstrap-sh-plugin-...`.
  Chose plugin-canonical (Option 1): clearest, removes the double-fire, matches where the
  project already went (versioned plugin.json, marketplace, dev-link loop).
- Private overlay tooling is still linked by bootstrap (it's NOT in the public plugin) —
  only the PUBLIC tooling symlinking moved behind LINK_TOOLING.
- Pre-existing stale PUBLIC tooling symlinks from an older full bootstrap are not auto-
  removed (risk of clobbering private links); README/output note the manual cleanup.
