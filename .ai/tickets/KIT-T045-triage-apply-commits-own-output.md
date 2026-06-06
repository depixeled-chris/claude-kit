---
id: KIT-T045
title: triage --apply commits its own markdown output
type: bug
status: review
priority: high
milestone:
labels: [triage, git, tooling]
links: []
files: [scripts/triage/apply.mjs, scripts/triage/commit.mjs, scripts/triage.test.mjs]
supersedes:
superseded_by:
created: 2026-06-06T00:00:00Z
updated: 2026-06-06T00:00:00Z
---

## Description
`scripts/triage.mjs --apply` (apply half in `scripts/triage/apply.mjs`) enacts triage decisions —
creates ticket/decision/note files, folds/supersedes, and MOVES processed inbox caps into
`inbox/triaged/` — but never committed its OWN output. The raw caps get auto-committed by the
separate Stop-hook "sync: workflow data" (`hooks/sync-data.mjs`), but apply's edits (new item files,
the inbox→triaged moves, fold/supersede edits) sat uncommitted until a later sync or a manual
commit. That lost the descriptive commit message and left a window where the triage result was
untracked.

## Acceptance Criteria
- [x] After a successful `--apply`, apply commits ITS output with a descriptive message
      (`triage: promote N caps -> tickets/decisions/notes [scope|cross-project]`).
- [x] Commits land in the correct working tree — the .ai stores can be a junction into the
      claude-kit-data repo, so the commit follows where the touched files actually resolve
      (mirrors `hooks/sync-data.mjs`).
- [x] Only the files triage wrote/moved are staged (specific pathspecs, never `git add -A`);
      unrelated dirty files in the data repo are left for the Stop-hook sync.
- [x] Robust: nothing to commit → clean no-op; a commit hiccup (no git, no repo, hook reject) never
      fails the already-succeeded apply — fail-open with a stderr warning.
- [x] Tests in `scripts/triage.test.mjs`: commits exactly the apply output with the descriptive
      message inside a real data repo (asserting the cap move is committed and unrelated files are
      NOT swept in), and no-ops cleanly outside any git repo.

## Plan
1. New atomic module `scripts/triage/commit.mjs` — single responsibility: stage + commit apply's
   touched paths, grouped by working tree, fail-open. Reuse the fail-open `git()` from `hooks/lib.mjs`.
2. apply.mjs records each receipt's original `cap.file` and calls `commitApply` after the write loop
   (before the cache re-sync).
3. Tests.

## Notes
- [2026-06-06] (comment) `git -C` needs a DIRECTORY, not a file (mirrors sync-data.mjs anchoring on
  the resolved .ai dir). Staging anchors on each file's own directory by basename — avoids manual
  repo-relative path math, which broke on Windows because `realpathSync` returns the 8.3 short form
  (`CHRISS~1`) for the mkdtemp file but the long form for the toplevel, so a `path.relative()` of the
  two produced an out-of-repo pathspec.
- [2026-06-06] (comment) git records the inbox→triaged move as a rename (R100); both sides land in the
  one staged change. Precise staging verified: an unrelated dirty file is left untouched.
- [2026-06-06] (comment) In this claude-kit repo `.ai` is in-repo (not a junction); the data-repo
  junction path is exercised by centralized projects (HOD-style). The resolution logic handles both.
