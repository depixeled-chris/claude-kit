---
id: KIT-T016
title: Enforce the harness-memory→.claude/memory unification (verify/create the link, don't trust setup)
type: feature
status: done
priority: high
milestone:
labels: [hooks, durability, memory, bootstrap]
links: [KIT-D016, KIT-D015, KIT-D002]
files:
  - hooks/orient.mjs
  - bootstrap.mjs
created: 2026-06-04T11:40:00Z
updated: 2026-06-11T05:27:45Z
---

## Description
Per KIT-D016, project `.claude/` is synced via the project repo and the harness's machine-local
auto-memory dir (`~/.claude/projects/<encoded>/memory/`) is unified into the committed
`.claude/memory/` by a symlink. Today that link is a MANUAL per-machine step — a fresh machine
that skips it writes memory machine-locally and loses it silently. KIT-D002 says enforce, don't
remember.

## Acceptance Criteria
- [x] On SessionStart (orient), detect whether `~/.claude/projects/<encoded>/memory/` is unified
      with the repo's committed `.claude/memory/` (symlink or equal real path).
- [x] If NOT unified: either create the link automatically (preferred, cross-platform incl.
      Windows junction) or surface a single loud warning with the exact fix command — so memory is
      never silently machine-local.
- [x] bootstrap.mjs sets up the unification as part of project adoption (idempotent, cross-platform).
- [x] Detect + warn on the divergent case (both dirs exist as real, differing copies) so an
      already-split machine is caught, not silently overwritten.
- [x] Test on a throwaway repo (link-present, link-absent, diverged-copies branches).

## Plan
1.

## Notes
- 2026-06-04: Filed after verifying this machine IS correctly linked (memory ->
  /d/dev/hustle-or-die/.claude/memory, MEMORY.md identical) — but the link is manual, which is the
  fragility. Maintainer: stop having to repeat the principles; make them self-enforcing.
- 2026-06-11: Implemented. Shared logic extracted to a new atomic module `hooks/memory-link.mjs`
  (the shared-helper hub lib.mjs was already AT the 800-line hard gate, so the concern got its own
  by-concern file per the contract; lib.mjs untouched in size). Surface: `repoMemoryDir`,
  `harnessMemoryDir` (encodes the ABSOLUTE project root with `[:\\/ ]→-`, the harness's own scheme;
  CLAUDE_HOME-overridable), `memoryUnification` (classifies unified/absent/diverged/no-repo-memory
  by realpath equality), `unifyMemory` (idempotent self-heal: junction on Windows / symlink on
  POSIX; NEVER clobbers a divergence), `memoryLinkCommand` (the exact per-OS fix). Wired into
  orient.mjs (SessionStart auto-heal → top banner: HEALED / SPLIT / NOT-UNIFIED) and bootstrap.mjs
  (sweeps every registered project + the cwd repo). All helpers fail-open.
  Real-world verified: classifies THIS machine's live hustle-or-die junction as `unified` → action
  `none` (does not touch it). Two production hardenings surfaced by the tests: (1) a dangling
  Windows junction is silently NOT removed by `fs.rmSync({recursive})` — added `removePathEntry`
  using rmdir/unlink so a stale link from a moved repo is replaced, not left as an EEXIST landmine;
  (2) `memoryUnification(null)` now fails open instead of throwing in `join`.
  Tests: `hooks/memory-link.test.mjs` — 35 assertions, all green; full `npm test` green (no
  regressions). uat=none (KIT-D034) → closing directly with test evidence.

## History
- [2026-06-11 05:07] (status) todo → doing
- [2026-06-11 05:26] (comment) ticked: orient self-heals via unifyMemory on SessionStart; memoryUnification classifies unified by realpath equality (symlink/junction or equal real path) — hooks/memory-link.mjs
- [2026-06-11 05:27] (comment) ticked: unifyMemory auto-creates the link (Windows junction / POSIX symlink) on the absent case; orient emits MEMORY LINK HEALED. Diverged/failed cases surface a loud banner with memoryLinkCommand (the exact fix).
- [2026-06-11 05:27] (comment) ticked: bootstrap.unifyProjectMemory() heals every registered project + the cwd repo on (re)bootstrap; idempotent, cross-platform, honors DRY_RUN, reports (never clobbers) a split.
- [2026-06-11 05:27] (comment) ticked: memoryUnification returns 'diverged' when both sides are real, non-empty, differing dirs; unifyMemory does NOT clobber (action diverged); orient + bootstrap warn with the fix command. Tested.
- [2026-06-11 05:27] (comment) ticked: hooks/memory-link.test.mjs: 35 assertions over throwaway repos+isolated CLAUDE_HOME — link-present/absent/diverged branches across lib, orient (subprocess), bootstrap (subprocess). Wired into npm test.
- [2026-06-11 05:27] (status) doing → done
