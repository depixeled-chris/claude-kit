---
id: KIT-D033
title: "`review` IS the UAT stage — no separate status; the UAT queue is surfaced every session, both ends"
date: 2026-06-10
supersedes:
source: maintainer interjection 2026-06-10 ("Are we supporting a UAT status now? That needs to be presented to me frequently.")
---

**Decision:** The UAT stage is the existing `review` status — Claude's "done, tested,
awaiting human acceptance" parking state. No separate `uat` status is added (the flow
stays `todo → doing → review → done`, `done` human-only). What changes is VISIBILITY:
the review/UAT queue is presented to the maintainer FREQUENTLY — at SessionStart (the
queue with ages) and at Stop when the queue grew that turn — implemented by KIT-T062.
KIT-T061 (test-evidence floor at review entry) defines what qualifies an item for UAT;
KIT-T075's `t status <id> done --human` is the acceptance action.

**Why:** The lifecycle review found 0 tickets ever reaching `done` with ~23 parked in
`review` — not because acceptance was hard but because the queue was invisible; nothing
ever presented it. A second status wouldn't fix invisibility (it would add a third
parking lot); loud, recurring presentation does. Rejected: a distinct `uat` status
(review already means exactly "awaiting acceptance"; statuses are config-driven, so a
project that genuinely needs both can add one locally without kit changes).
