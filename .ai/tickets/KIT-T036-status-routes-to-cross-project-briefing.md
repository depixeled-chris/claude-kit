---
id: KIT-T036
title: "\"status\" defaults to the cross-project briefing (terse, cache-backed) — not a single-repo readout"
type: feature
status: review
priority: high
milestone:
labels: [survey, prime, standup, status, dx, wall-of-text]
links: [KIT-T001, KIT-T026]
aka: []
files:
  - scripts/survey.mjs
  - commands/status.md
  - commands/standup.md
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Description
A bare "status" / "what's our status?" from a clean session got answered as a single-repo
readout (the active repo's SESSION.md) and dumped a wall of text. "status" is the natural word
for the cross-project glance, but nothing routed it there, and the briefing itself was too long.
The fix routes "status" to the survey (cache-backed via KIT-T026) and makes the glance terse —
the script supplies truth, Claude distills it to a glanceable briefing without hand-reading files.

## Acceptance Criteria
- [x] `/status` command runs `survey.mjs --brief` — the cross-project "what needs me?" glance,
      read-only (no resume, no scope confirm).
- [x] `--brief` mode: review backlog collapsed to count + first ids; **no active-project SESSION
      dump**. Naming a project still gives the full deep view.
- [x] `/standup` switched to `--brief` (it is a glance); `/prime` stays full-depth (it is a resume).
- [x] Output stays cache-backed (survey queries the cache, scan fallback) — no manual file reads.

## Notes
- 2026-06-05: Added `--brief` to survey.mjs (collapse reviews, drop SESSION dump), new
  `commands/status.md`, switched standup to brief. Verified live: brief briefing is ~12 lines
  vs the prior ~30-line wall. The capture that spawned this is in the KIT inbox (status-defaults-…).
- Distillation is the model's job: the survey is the source of truth; Claude renders the
  glanceable summary from it (reasonable detail, token-aware) rather than echoing raw output.
- 2026-06-05 (triage): inbox cap `2026-06-05-0158-status-defaults-to-cross-project-briefing`
  folded here — exact duplicate of this already-`review` ticket; no new ticket created.
