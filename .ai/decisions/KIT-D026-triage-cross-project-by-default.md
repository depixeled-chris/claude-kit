---
id: KIT-D026
title: Triage runs cross-project by default; --scope only on explicit single-project request
date: 2026-06-05
supersedes:
source: conversation 2026-06-05
---

**Decision:** `triage` is ALWAYS cross-project. Run `triage.mjs --plan` / `--apply`
with NO `--scope`, draining every project's inbox in one pass. Pass `--scope <KEY>`
ONLY when the maintainer explicitly names a single project to confine to. The tool
already defaults this way (omitting `--scope` scans all scopes); this fixes the
*behavior* — agents and the `/triage` command must not narrow it unbidden.

**Why:** Inboxes are cross-project by nature and a scoped run silently skips other
projects' pending caps — the maintainer can't tell a "clean" all-projects result from
a scoped one that ignored three other backlogs. Defaulting to the whole set makes the
"0 caps remaining" receipt trustworthy. Rejected: keeping scope a per-run judgment
call — that's exactly what produced a single-project triage when the maintainer
expected all of them.
