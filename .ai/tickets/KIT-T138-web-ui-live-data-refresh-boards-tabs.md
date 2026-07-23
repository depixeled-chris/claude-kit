---
id: KIT-T138
title: Web UI live data refresh — boards/tabs reflect store changes without manual reload
type: feature
status: todo
priority: high
milestone:
labels: [ui, web-ui, server]
aka: []
parent:
introduced_by:
produced_by:
informs: []
links: [KIT-D044, KIT-T132, KIT-T137]
files: []
tier:
model:
effort:
supersedes:
superseded_by:
created: 2026-07-23T11:40:00Z
updated: 2026-07-23T11:40:00Z
---

## Description
Chris (2026-07-23, UAT): "I'm not seeing live reloads either." Every view
fetches once at mount; a ticket status change, a new capture, or another
session's commit doesn't appear until a manual browser refresh. The
`kit:projects-changed` event (KIT-T137) covers only same-tab settings saves.

Wanted: boards, the waiting board, and nav badges track the markdown truth
live — plausible shapes: SSE from the server's hydrate path, fs-watch →
event stream, or interval polling as the cheap first cut.

## Acceptance Criteria
- [ ] A ticket status change on disk shows on an open board without a manual
      refresh (bounded staleness, e.g. <=5s).
- [ ] Nav review-count badges update on the same signal.
- [ ] No thundering rehydrate: refresh signal is debounced/cheap.

## Plan
1. Decide transport (SSE vs poll) against the cache-read architecture.
2. Implement + wire useAsync reloads to the signal.

## Notes
Captured during the 2026-07-23 UAT session; not built in that pass — needs
its own architecture decision (transport + cache interplay).

## History
- [2026-07-23 11:40] (created) captured from UAT feedback
