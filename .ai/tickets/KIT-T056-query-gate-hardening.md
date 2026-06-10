---
id: KIT-T056
title: query-gate judges every pipeline segment and stops false-blocking legit notes/ tickets/ paths
type: bug
status: todo
priority: high
milestone: M1-gate-integrity
labels: [hooks, gates]
files:
  - hooks/query-gate.mjs
  - hooks/query-gate.test.mjs
links: [KIT-T050]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Two weaknesses from the KIT-T050 retrieval gate:
1. Leader-split escape: only the segment before the first `|` is judged
   (query-gate.mjs:49), so `true || grep -rn x .ai/` or any post-pipe store grep passes.
2. False positive: the STORE regex (line 32) matches ANY path containing `notes/`,
   `tickets/`, etc. — a legit `src/notes/` directory in a user project gets blocked.

## Acceptance Criteria
- [ ] All command segments (split on |, ;, &&, ||) are judged, not just the leader.
- [ ] STORE matching is anchored to an actual `.ai/` store root (or the registered dataRoot), not bare directory-name substrings; `src/notes/` greps pass.
- [ ] Tests cover the pipe/chain escape and the src/notes false positive.
- [ ] Existing query-gate tests stay green.

## Plan
1. Segment-split the command line before judging.
2. Anchor store-path detection to `.ai/` (and registry dataRoots).
3. Tests.

## Notes
- 2026-06-09: opened from the full-plugin process review.
