---
id: KIT-D013
title: "Plugin owns the tooling; bootstrap owns only CLAUDE.md + overlay (reconciles KIT-D001)"
date: 2026-06-03
---

Decided: the **plugin** (`.claude-plugin/` + `hooks/hooks.json`) is the canonical
installer for all PUBLIC tooling — commands, hooks, skills, agents — auto-wired on
install. `bootstrap.sh` installs ONLY what a plugin cannot reach: the composed
`~/.claude/CLAUDE.md` (public base + private overlay), the PRIVATE overlay's own tooling
(not in the public plugin), and the statusline. `bootstrap.sh` defaults to this
overlay-only mode; `LINK_TOOLING=1` restores the legacy full symlink install for machines
that do NOT use the plugin.

Rejected: keeping `bootstrap.sh` as a second full installer of the public tooling
alongside the plugin. Why: a machine with both installed double-registers the same
tooling — every hook fires twice (commit-gate blocks twice, orient/housekeeping print
twice, sync-data commits twice) and commands/skills appear twice (plugin-namespaced AND a
bare symlinked copy). bootstrap had **zero** plugin-awareness, so this happened silently.
That confusion is the bug that surfaced 2026-06-03 (a second machine's Claude couldn't
tell which mechanism was in force).

Reconciles KIT-D001: that decision ("`~/.claude` is a derived install; `bootstrap.sh`
symlinks from the kit; reproduce with `git clone && ./bootstrap.sh`") predates the plugin
packaging (landed `[no-log: tooling packaging]` 2026-06-02 and never reconciled).
KIT-D001's core principle still holds — the kit repo is the single source of truth for all
tooling — but the *delivery* of public tooling to `~/.claude` is now the plugin's job, not
bootstrap's. The README "Install — two mechanisms, one rule" section documents the split
so this can't recur (maintainer directive 2026-06-03).
Source: HOD session 2026-06-03; see KIT-T010.
