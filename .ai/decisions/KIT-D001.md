---
id: KIT-D001
title: "claude-kit is the single source of truth for all Claude tooling"
date: 2026-06-02
---

Decided: every Claude *tool* — hooks, slash commands, statusline, the settings
template, and the global CLAUDE.md rules — is authored and versioned HERE. `~/.claude`
becomes a derived install: `bootstrap.sh` symlinks/merges from the kit. Reproduce a
machine with `git clone && ./bootstrap.sh`.
Rejected: hand-maintaining `~/.claude` per machine. Why: it's unversioned and
machine-local, silently drifts across machines, and can't be reproduced — exactly the
amnesia this kit exists to kill. Nothing tooling-related is authored in two places.

Reconciled by KIT-D013 (2026-06-03): the kit repo is still the single source of truth,
but DELIVERY of public tooling to `~/.claude` is now the **plugin's** job, not
`bootstrap.sh`'s. bootstrap installs only what a plugin can't (CLAUDE.md + private
overlay + statusline). "Reproduce with `git clone && ./bootstrap.sh`" alone is no longer
the full install — install the plugin for tooling, run bootstrap for CLAUDE.md/overlay.
