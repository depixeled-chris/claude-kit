---
id: KIT-T016
title: Enforce the harness-memory→.claude/memory unification (verify/create the link, don't trust setup)
type: feature
status: todo
priority: high
milestone:
labels: [hooks, durability, memory, bootstrap]
links: [KIT-D016, KIT-D015, KIT-D002]
files:
  - hooks/orient.mjs
  - bootstrap.mjs
created: 2026-06-04T11:40:00Z
updated: 2026-06-04T11:40:00Z
---

## Description
Per KIT-D016, project `.claude/` is synced via the project repo and the harness's machine-local
auto-memory dir (`~/.claude/projects/<encoded>/memory/`) is unified into the committed
`.claude/memory/` by a symlink. Today that link is a MANUAL per-machine step — a fresh machine
that skips it writes memory machine-locally and loses it silently. KIT-D002 says enforce, don't
remember.

## Acceptance Criteria
- [ ] On SessionStart (orient), detect whether `~/.claude/projects/<encoded>/memory/` is unified
      with the repo's committed `.claude/memory/` (symlink or equal real path).
- [ ] If NOT unified: either create the link automatically (preferred, cross-platform incl.
      Windows junction) or surface a single loud warning with the exact fix command — so memory is
      never silently machine-local.
- [ ] bootstrap.mjs sets up the unification as part of project adoption (idempotent, cross-platform).
- [ ] Detect + warn on the divergent case (both dirs exist as real, differing copies) so an
      already-split machine is caught, not silently overwritten.
- [ ] Test on a throwaway repo (link-present, link-absent, diverged-copies branches).

## Plan
1.

## Notes
- 2026-06-04: Filed after verifying this machine IS correctly linked (memory ->
  /d/dev/hustle-or-die/.claude/memory, MEMORY.md identical) — but the link is manual, which is the
  fragility. Maintainer: stop having to repeat the principles; make them self-enforcing.
