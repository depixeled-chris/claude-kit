---
id: KIT-T093
title: Re-key hustle-or-die HOD-T###->HOD-R### into requests/ with aka: backfill (KIT-T003 child, cross-repo)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T091, KIT-T092]
files: []
supersedes:
superseded_by:
created: 2026-06-12T19:52:29Z
updated: 2026-06-12T19:52:29Z
---

## Description
Child of [[KIT-T003]] (criterion 4) — the CROSS-REPO product re-key. hustle-or-die's
`R`-series work items are Requests filed as tickets; move them `tickets/` → `requests/`,
`HOD-T### → HOD-R###`, with `aka:` preserving the bare `R###`. **Gated on [[KIT-T091]]
(aka:) and [[KIT-T092]] (R type + requests/ store) — both must land first.** This is the
"focused next unit" the maintainer chose: execute with full cross-repo verification, NOT
bundled into a multi-ticket batch.

## Acceptance Criteria
- [ ] Every HOD `R`-series item is moved `tickets/` → `requests/` and re-keyed `HOD-T### → HOD-R###` via `rekey-ids.mjs` (no hand renames).
- [ ] Each re-keyed item carries `aka:` with its prior id (bare `R###` + old `HOD-T###`) so it stays discoverable.
- [ ] All cross-references to the old ids (other tickets, docs, ROADMAP, SESSION) are updated OR resolve via `aka:`; a grep for dangling old ids is clean (or every hit is an intentional historical mention).
- [ ] HOD's `.ai/` board/cache regenerate cleanly; `q` resolves both new and aka ids.
- [ ] Done as ITS OWN coordinated commit(s) in the HOD repo (+ any claude-kit tooling change), both repos verified clean before/after.

## Plan
1. PREREQ: T091 + T092 landed.
2. Enumerate the HOD `R`-series items (which `HOD-T###` are actually Requests) — confirm the set with the maintainer before moving.
3. `rekey-ids.mjs` run (move + re-key + aka backfill); update cross-refs.
4. Verify: dangling-id grep, board/cache regen, `q` resolution; coordinated commit per repo.

## History
- [2026-06-12 19:52] (created) feature — Re-key hustle-or-die HOD-T###->HOD-R### into requests/ with aka: backfill (KIT-T003 child, cross-repo)
