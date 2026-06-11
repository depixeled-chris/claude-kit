---
id: KIT-T065
title: Triage-time provenance inference — bugs without user-given provenance get inferred links
type: feature
status: done
priority: high
milestone: M3-provenance
labels: [triage, provenance, regressions]
files:
  - commands/triage.md
  - scripts/triage/provenance.mjs
  - scripts/triage/plan.mjs
  - scripts/triage/apply.mjs
  - scripts/triage/write-item.mjs
  - scripts/triage.test.mjs
  - project-template/.ai/tickets/_TEMPLATE.md
links: [KIT-T048, KIT-T049, KIT-T066]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-11T03:20:24Z
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
- [x] Triage of a bug/regression with empty provenance fields runs the inference and proposes candidates (top-N with the evidence: file, governing item, commit).
- [x] Accepted links land in frontmatter with a `provenance: inferred` marker; user-supplied links marked `given`.
- [x] Inference degrades gracefully when code-graph/q caches are cold (states "no candidates", never blocks triage).
- [x] A worked example in the ticket's Notes from a real misfiled-era bug.

## Plan
1. triage.mjs: candidate resolver (files → q → git log).
2. triage.md prose: when to run, how to present candidates.
3. Frontmatter marker + docs.

## Notes
- 2026-06-09: opened from the lifecycle review — "the retrieval layer already answers the hard question; nothing asks it at intake."
- 2026-06-10: Implemented. Resolver `scripts/triage/provenance.mjs` — `inferProvenance(symptom, repoRoot)`:
  (1) parse implicated files from the symptom (bare filenames + slash-paths), resolve against the repo's
  real `git ls-files` set, widen via code-graph `importers-of`; (2) `q governing <files>` → candidate
  `regressed_from`; (3) `git log` those files (+ any prose-named sha, git-verified) → candidate
  `causing_commit`. Returns top-3 candidates, each an evidence bundle `{file, regressed_from, governing,
  causing_commit, commit, source}`. Absolute fail-open: cold code-graph/q cache, non-git dir, missing
  history, or any throw → `{candidates: []}`, never blocks triage. Wired into `triage --plan` (per
  bug/regression cap, as `item.provenance`) and `--apply` (an accepted candidate writes the link +
  `provenance: inferred|given` marker into the new ticket's frontmatter, via `write-item.appendProvenance`).
- 2026-06-10: WORKED EXAMPLE (real misfiled-era HOD bug, re-homed by KIT-T067 — run READ-ONLY against
  `D:/dev/hustle-or-die`). Cap: *"NO STREETS rendering in-game — roads/asphalt gone after the block-buildup
  integrated-ground-mesh merge (6712903, HOD-T097). chunkGround.ts … stopped emitting the road/asphalt
  surface."* Resolver output:
    - implicated files: `src/render/assets/ground/chunkGround.ts` (from symptom) → widened to
      `src/render/Assets.ts` (its importer, via code-graph).
    - candidate `regressed_from` (q governing): HOD-D015, HOD-D016, HOD-D024, HOD-D025, HOD-D026, … (the
      open decisions governing `src/render/assets/*`).
    - top candidate (named-sha, git-verified): `causing_commit=6712903` "Merge block-buildup: integrated
      ground mesh + GroundRegion/ParkingLot data", `regressed_from=HOD-D015`.
    - #2/#3 (git-log of chunkGround.ts): `933591f`, then `4afd9e6` "HOD-T097: integrated ground mesh …".
  The mechanically-proposed #1 is exactly the merge the symptom blames — the question forward-provenance
  never asked at intake, now answered from primitives the kit already owned.
- 2026-06-10: Tests — 5 cases added to `scripts/triage.test.mjs` (pure parsers; precondition; top-N
  WITH evidence against a git fixture; fail-open on cold/non-git; frontmatter `inferred` vs `given`
  marker). `node scripts/triage.test.mjs` 10/10; `node scripts/test-hooks.mjs` 111/111; full `npm test`
  green (verified 3× — fixed a sha-parse flake where a random all-digit short sha needed a commit cue).

## History
- [2026-06-11 03:05] (status) todo → doing
- [2026-06-11 03:20] (comment) ticked: inferProvenance proposes top-3 candidates w/ evidence (file+governing+commit); wired into triage --plan as item.provenance; test: top-N WITH evidence
- [2026-06-11 03:20] (comment) ticked: write-item.appendProvenance writes regressed_from/causing_commit + provenance: inferred|given; test: marker inferred vs given
- [2026-06-11 03:20] (comment) ticked: absolute fail-open: cold/non-git/missing-history -> {candidates:[]}, never throws; test: cold/non-git fail-open
- [2026-06-11 03:20] (comment) ticked: worked example in Notes: real HOD NO-STREETS bug -> #1 candidate 6712903 (the blamed merge)
- [2026-06-11 03:20] (status) doing → done
