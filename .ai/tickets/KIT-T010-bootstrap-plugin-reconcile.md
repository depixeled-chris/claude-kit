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
- 2026-06-03: Triaged from inbox capture `2026-06-03-2245-bootstrap-sh-plugin-...`.
  Chose plugin-canonical (Option 1): clearest, removes the double-fire, matches where the
  project already went (versioned plugin.json, marketplace, dev-link loop).
- Private overlay tooling is still linked by bootstrap (it's NOT in the public plugin) —
  only the PUBLIC tooling symlinking moved behind LINK_TOOLING.
- Pre-existing stale PUBLIC tooling symlinks from an older full bootstrap are not auto-
  removed (risk of clobbering private links); README/output note the manual cleanup.
