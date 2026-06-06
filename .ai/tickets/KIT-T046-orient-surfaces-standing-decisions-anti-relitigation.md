---
id: KIT-T046
title: orient surfaces STANDING decisions every session (anti-relitigation; settled calls must never age out)
type: bug
status: review
priority: high
milestone:
labels: [process-failure, orient]
links: []
files: [hooks/orient.mjs]
supersedes:
superseded_by:
created: 2026-06-06T02:30:00Z
updated: 2026-06-06T02:30:00Z
---

## Description
A settled decision was presented to the maintainer as an open question (the HOD world-gen home — Rust-native — already fixed by HOD-D010 + the rust-world-architecture north star + R050 §8). Root cause: `orient.mjs recentDecisions(8)` surfaces only the latest 8 decisions by id, so standing constraints age out of session context once 8 newer decisions exist; the agent then re-litigated a closed call. The whole point of the kit is that the maintainer does not repeat themselves and nothing gets lost — a standing constraint aging out of context is a kit failure, not a judgment lapse.

## Acceptance Criteria
- [x] Decisions can be flagged `standing: true` in frontmatter.
- [x] orient.mjs surfaces ALL standing decisions every session under a distinct "STANDING decisions (settled — CITE, never re-ask or relitigate)" header, regardless of age, in addition to the recent-8 list.
- [x] Standing surfacing is robust (fail-open on unreadable/missing dir; no crash) and syntax-checked.
- [x] Kit test suite stays green (162 assertions, 0 fail).
- [x] HOD's settled constraints pinned `standing: true` (HOD-D010, D015, D016) + explicit closed-call HOD-D017 (world-gen is Rust-native).

## Plan
1. Factor decision frontmatter parsing; add `standingDecisions()` scanning all files for `standing: true`.
2. Emit a STANDING block before the recent block in orient output.
3. Pin the relevant HOD decisions; add HOD-D017 to make the world-gen home citable in one line.

## Notes
- 2026-06-06: Implemented in hooks/orient.mjs (decisionFiles/decisionMeta/standingDecisions). Verified D010 (the aged-out culprit) + D017 surface regardless of age. Kit suite green.
- Follow-up candidate (not this ticket): a pre-AskUserQuestion guard that greps DECISIONS for the topic and blocks/ warns on a settled match — surfacing aids reasoning but does not ENFORCE it. Capture separately if the maintainer wants enforcement, not just visibility.
