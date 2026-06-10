---
id: KIT-T056
title: query-gate judges every pipeline segment and stops false-blocking legit notes/ tickets/ paths
type: bug
status: review
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
- [x] All command segments (split on |, ;, &&, ||) are judged, not just the leader.
- [x] STORE matching is anchored to an actual `.ai/` store root (or the registered dataRoot), not bare directory-name substrings; `src/notes/` greps pass.
- [x] Tests cover the pipe/chain escape and the src/notes false positive.
- [x] Existing query-gate tests stay green.

## Plan
1. Segment-split the command line before judging.
2. Anchor store-path detection to `.ai/` (and registry dataRoots).
3. Tests.

## Notes
- 2026-06-09: opened from the full-plugin process review.
- 2026-06-09: implemented. Quote-aware `segments()` tags each segment with its preceding
  operator: single `|` = stdin filter (search/read with no FILE arg allowed — quoted
  spans stripped, a search tool's first bare positional is its PATTERN, not a path);
  `||`/`&&`/`;`/`&` segments judged in full (the `true || grep .ai/` escape). `xargs`
  unwrapped and its command judged un-piped (`find | xargs grep` = discovery). STORE
  regex anchored to token start for bare store dirs (src/notes/ passes) + a
  `projects/<name>/<store>` alternative for centralized data roots. DOGFOOD: the first
  cut's path-ish heuristic false-positived on this very session's `npm test |
  select-string -pattern '^(all pass|\d+ FAIL)'` (regex `\d` read as a path) — fixed by
  pattern/file distinction + regression-tested. 26/26 query-gate + full suite green.
