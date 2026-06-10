---
id: KIT-T065
title: Triage-time provenance inference — bugs without user-given provenance get inferred links
type: feature
status: todo
priority: high
milestone: M3-provenance
labels: [triage, provenance, regressions]
files:
  - commands/triage.md
  - scripts/triage.mjs
links: [KIT-T048, KIT-T049, KIT-T066]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Forward provenance (request → ticket → commit) is gate-enforced; backward provenance
(bug → causing change) is pure judgment with zero mechanical assistance. A bug reported
cold — no ticket reference, no suspect commit — gets classified with nothing filled in,
so `regressed_from`/`causing_commit` have never been populated once. The kit already
owns every primitive needed; nothing asks the question at intake.

Triage step for provenance-less bugs:
1. Identify implicated files from the symptom/repro (code-graph lookup).
2. `q` the governing tickets/decisions for those files (the KIT-T049 file-scoped lookup,
   pointed at bug-intake time instead of edit time) → candidate `regressed_from`.
3. `git log` those files since last-known-good → candidate `causing_commit`s.
4. Record links tagged `provenance: inferred` vs `provenance: given` so a wrong inference
   is auditable, never silently authoritative.

## Acceptance Criteria
- [ ] Triage of a bug/regression with empty provenance fields runs the inference and proposes candidates (top-N with the evidence: file, governing item, commit).
- [ ] Accepted links land in frontmatter with a `provenance: inferred` marker; user-supplied links marked `given`.
- [ ] Inference degrades gracefully when code-graph/q caches are cold (states "no candidates", never blocks triage).
- [ ] A worked example in the ticket's Notes from a real misfiled-era bug.

## Plan
1. triage.mjs: candidate resolver (files → q → git log).
2. triage.md prose: when to run, how to present candidates.
3. Frontmatter marker + docs.

## Notes
- 2026-06-09: opened from the lifecycle review — "the retrieval layer already answers the hard question; nothing asks it at intake."
