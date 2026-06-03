---
id: KIT-T011
title: Cross-platform tooling — no script may assume Windows/macOS/Linux
type: bug
status: todo
priority: high
milestone:
labels: [portability, cross-platform, bootstrap, install]
links: [KIT-D001, KIT-D013]
files:
  - bootstrap.sh
  - .gitattributes
created: 2026-06-03T23:10:00Z
updated: 2026-06-03T23:10:00Z
---

## Description
Maintainer directive (2026-06-03): "NONE of this tooling should assume Windows or Mac or
Linux. It should run on any of them." Audit + close every OS assumption in the kit's own
tooling. The Node scripts (cap, init-project, index-tickets, id-utils, next-id, check-ids,
hooks) already run on any OS — Node is the one runtime required on every machine. The
genuine violation is `bootstrap.sh`: `#!/usr/bin/env bash` + `ln -s`, so it runs only under
POSIX/WSL, not native Windows.

## Acceptance Criteria
- [x] Deterministic line endings via `.gitattributes` (`* text=auto eol=lf` + binary marks)
      so a CRLF-authored script can't break bash/node on another OS.
- [x] id tooling reports POSIX-style paths on every OS (done under KIT-T009).
- [ ] Port `bootstrap.sh` → a Node installer (`bootstrap.mjs`) that runs on Windows,
      macOS, and Linux: compose `~/.claude/CLAUDE.md`, link the private overlay + statusline
      (dir links via junction on Windows; file links symlink-or-copy with a privilege
      fallback), and the `LINK_TOOLING=1` legacy path. Keep the overlay-only default (KIT-D013).
- [ ] README install steps use the portable invocation; verify on Windows + at least one POSIX OS.
- [ ] Sweep the remaining scripts/hooks for any lingering OS assumption; none may remain.

## Plan
1. Confirm the Windows symlink approach (junction for dirs; symlink-or-copy for the
   statusline file) — design fork, maintainer's call.
2. Write `bootstrap.mjs` mirroring the slimmed `bootstrap.sh` behavior; test on Windows here.
3. Update README + the layout line; decide whether `bootstrap.sh` stays as a thin POSIX
   convenience wrapper or is removed.

## Notes
- 2026-06-03: `.gitattributes` added (no renormalization churn — repo was already LF).
  bootstrap port deferred to a maintainer go (it changes the documented setup flow + adds
  a new file). Audit found NO other OS assumptions in the Node tooling.
