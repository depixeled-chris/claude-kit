---
id: KIT-T084
title: pre-write magic-numbers hook ignores file-level ignore markers and .claude-kit-ignore.yaml globs
type: bug
status: doing
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-06-11T03:49:52Z
updated: 2026-06-11T21:26:12Z
---

## Description
Observed 2026-06-11 editing rg-render WGSL shaders (hustle-or-die/rapid-game):
files declaring `// claude-kit-ignore-file magic-numbers — <trailing prose>` on
line 1 (committed earlier WITH such markers) still get BLOCKED on `0.0`/`1.0`
literals. Both `.claude-kit-ignore.yaml` at the repo root AND at the submodule
root (`magic-numbers: [path glob]`) were also ignored. Only block
(`ignore-start`/`ignore-end`) and trailing line markers worked. Suspect the
file-level marker parser stops matching when trailing text follows the check
id (em-dash prose), and the yaml lookup may not resolve from the edited file's
repo root. Related capture: claude-kit inbox 2026-06-11-0342.

## Acceptance Criteria
- [x] `claude-kit-ignore-file <id> — prose` (trailing text after the id) suppresses the check for the whole file
- [x] `.claude-kit-ignore.yaml` globs are honored from the nearest enclosing repo root (incl. submodules)
- [x] hook tests cover both marker-with-prose and yaml-glob cases

## Plan
1. Repro in test-hooks.mjs with a fixture file carrying a trailing-prose file marker.
2. Fix marker regex + yaml root resolution in pre-write.mjs.
3. Remove the workaround trailing markers from rg-render shaders (noted in their commit).

## History
- [2026-06-11 03:49] (created) bug — pre-write magic-numbers hook ignores file-level ignore markers and .claude-kit-ignore.yaml globs
- [2026-06-11 21:26] (status) todo → doing
- [2026-06-11 21:30] (comment) ticked: `claude-kit-ignore-file <id> — prose` (trailing text after the id) suppresses the check for the whole file
- [2026-06-11 21:30] (comment) ticked: hook tests cover both marker-with-prose and yaml-glob cases
- [2026-06-11 21:31] (comment) ticked: `.claude-kit-ignore.yaml` globs are honored from the nearest enclosing repo root (incl. submodules)

## Notes
2026-06-11 — Fix 1: `markerExcludedLines` in lib.mjs changed id capture from `\S+` to `[\w*-]+`
so an em-dash or parenthesis directly adjacent to the id (no space) no longer swallows it
into an unrecognisable token. Fix 2: pre-write.mjs ROOT now uses `gitRoot(dirname(file))` with
`projectRoot` fallback; git rev-parse --show-toplevel respects submodule boundaries so
.claude-kit-ignore.yaml is read from the submodule root, not the superproject. 5 new tests
in scripts/test-hooks.mjs: 3 marker-with-prose variants + 2 submodule yaml-glob cases.
124 passed, 0 failed.
