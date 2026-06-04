---
id: KIT-T022
title: Hard license guard — block GPL/LGPL/AGPL/unlicensed code from entering a repo; THIRD_PARTY_LICENSES ledger
type: feature
status: todo
priority: high
labels: [hooks, licensing, open-core, enforcement]
links: [KIT-D002]
files: [hooks/]
created: 2026-06-04T13:00:00Z
updated: 2026-06-04T13:00:00Z
---

## Description
From the HOD OSS survey (HOD-T062): copyleft contamination of a commercial product is MORE
irreversible than the MIT-backport risk scope already guards. Add a hard, enforced rule (a hook):
no GPL/LGPL/AGPL or unlicensed third-party code enters the repo; permissive (MIT/Apache/BSD/ISC)
only, or reference-only (techniques, not code). Plus a THIRD_PARTY_LICENSES attribution ledger that
must be updated before any borrowed dep lands.

## Acceptance Criteria
- [ ] A hook flags added dependencies / vendored code whose license is copyleft or unknown (scan package.json adds + vendored files), blocking until cleared.
- [ ] A THIRD_PARTY_LICENSES ledger convention; commit-gate-style nudge to update it when a dep is added.
- [ ] Opt-in-aware; documented; no existing hook weakened.

## Notes
- 2026-06-04: Raised by the OSS survey — the best-fit city/building-gen code is all GPL/AGPL, so
  this guard is load-bearing for HOD's commercial + open-core posture.
