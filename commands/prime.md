---
description: Resume work — load handoff state and the active ticket, confirm scope, continue
---
Resume this project. Read `.ai/SESSION.md`, then the active ticket in
`.ai/tickets/` it names (if any), then the source files SESSION.md points to.
Read `.ai/config.yml` for the workflow rules and `.ai/DECISIONS.md` for settled
points.

**Take the working-tree temperature** — git state is part of the record, not
separate from it. Review what the `orient` hook surfaced (uncommitted + unpushed +
local-only branches across the project, its data repo, and `watch_repos`); or run
`git status` + check for unpushed commits/branches yourself. **Reconcile** any
uncommitted / unpushed / local-only work against the plan: a context clear can land
mid-work, so don't assume "pushed = done" or that the written record is the whole
truth. Surface drift (work on disk that the plan doesn't mention, or vice-versa).

Restate the goal and the next 3 steps, confirm scope, then continue. Do not re-read
whole directories — follow the pointers in SESSION.md only.
