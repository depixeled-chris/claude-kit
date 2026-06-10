---
id: KIT-T011
title: Cross-platform tooling — no script may assume Windows/macOS/Linux
type: bug
status: done
priority: high
milestone:
labels: [portability, cross-platform, bootstrap, install]
links: [KIT-D001, KIT-D013]
files:
  - bootstrap.sh
  - .gitattributes
created: 2026-06-03T23:10:00Z
updated: 2026-06-10T06:00:00Z
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
- [x] Port `bootstrap.sh` → a Node installer (`bootstrap.mjs`) that runs on Windows,
      macOS, and Linux: compose `~/.claude/CLAUDE.md`, link the private overlay + statusline
      (dir links via junction on Windows; file links symlink-or-copy with a privilege
      fallback), and the `LINK_TOOLING=1` legacy path. Keep the overlay-only default (KIT-D013).
      `bootstrap.sh` is now a thin POSIX wrapper (`exec node bootstrap.mjs`).
- [x] README install steps use the portable invocation (`node bootstrap.mjs`).
- [x] Swept scripts/hooks: the only OS branches (`lib.mjs` have()/nodeCli(), commit-gate
      MSYS path xlate) HANDLE every OS rather than assuming one — no lingering assumption.

## Plan
1. Confirm the Windows symlink approach (junction for dirs; symlink-or-copy for the
   statusline file) — design fork, maintainer's call.
2. Write `bootstrap.mjs` mirroring the slimmed `bootstrap.sh` behavior; test on Windows here.
3. Update README + the layout line; decide whether `bootstrap.sh` stays as a thin POSIX
   convenience wrapper or is removed.

## Notes
- 2026-06-03: `.gitattributes` added (no renormalization churn — repo was already LF).
  Audit found NO other OS assumptions in the Node tooling.
- 2026-06-03: Ported bootstrap to `bootstrap.mjs` (Node) and TESTED ON WINDOWS into temp
  dirs: overlay-only composed CLAUDE.md + statusline (the Windows no-symlink-privilege case
  hit the EPERM→copy fallback, as designed); LINK_TOOLING=1 linked 7 commands/11 hooks +
  skills dir junctions; a fake private overlay composed base+private CLAUDE.md and linked a
  private command. `bootstrap.sh` reduced to a thin POSIX wrapper. README updated.
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
