---
id: KIT-T007
title: Cross-project lineage registry + orient resume-surfacing (decisions dir + lineage)
type: feature
status: done
priority: medium
labels: [hooks, orient, lineage, resume]
links: [KIT-T006]
aka: [lineage.yml, lineage registry]
files:
  - hooks/lib.mjs
  - hooks/orient.mjs
created: 2026-06-03T16:55:00Z
updated: 2026-06-10T06:00:00Z
---

## Description
A blank-context resume reconstructed cross-project lineage from memory and got it wrong
(2026-06-03: "HOD descends from marble-madness", and chasing the dead `rapid-rust`). Capture the
lineage on disk and surface it on resume so it's read, not invented. Plus a real bug: orient
pointed at a legacy `.ai/DECISIONS.md` file, but projects use a `.ai/decisions/` DIRECTORY — so
recorded decisions never surfaced at SessionStart.

## Acceptance Criteria
- [x] Per-project `.ai/lineage.yml`: list entries `{name, role, note, url?, path?}`,
      role ∈ engine | ancestor | sibling | dead. Paths relative (machine-portable).
- [x] `lib.mjs readLineage(root)` — tolerant line-by-line parse (no YAML dep), returns [] on error.
- [x] `orient.mjs` prints a `Lineage` section at SessionStart from `readLineage`.
- [x] `orient.mjs` reads the decisions **directory** (recent id — title lines), falling back to
      the legacy `DECISIONS.md` file when no dir exists. (Fixes the stale-path bug; same class as
      the `flush.mjs` fix in KIT-T006.)
- [x] Verified by live run against hustle-or-die: HOD-D001..D005 + all lineage entries surface.

## Notes
- 2026-06-03: Built + verified live. Seeded `hustle-or-die/.ai/lineage.yml` (rapid-game=engine,
  gta7=ancestor, rapid-rust=dead, wordslide-codex + marble-madness=siblings).
- Follow-on: survey.mjs cross-project view could print a one-line lineage digest too (not done here).
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
