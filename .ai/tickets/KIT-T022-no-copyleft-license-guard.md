---
id: KIT-T022
title: Hard license guard — block GPL/LGPL/AGPL/unlicensed code from entering a repo; THIRD_PARTY_LICENSES ledger
type: feature
status: done
priority: high
labels: [hooks, licensing, open-core, enforcement]
links: [KIT-D002]
files: [hooks/]
created: 2026-06-04T13:00:00Z
updated: 2026-06-11T08:00:00Z
---

## Description
From the HOD OSS survey (HOD-T062): copyleft contamination of a commercial product is MORE
irreversible than the MIT-backport risk scope already guards. Add a hard, enforced rule (a hook):
no GPL/LGPL/AGPL or unlicensed third-party code enters the repo; permissive (MIT/Apache/BSD/ISC)
only, or reference-only (techniques, not code). Plus a THIRD_PARTY_LICENSES attribution ledger that
must be updated before any borrowed dep lands.

## Acceptance Criteria
- [x] A hook flags added dependencies / vendored code whose license is copyleft or unknown (scan package.json adds + vendored files), blocking until cleared.
- [x] A THIRD_PARTY_LICENSES ledger convention; commit-gate-style nudge to update it when a dep is added.
- [x] Opt-in-aware; documented; no existing hook weakened.

## Notes
- 2026-06-04: Raised by the OSS survey — the best-fit city/building-gen code is all GPL/AGPL, so
  this guard is load-bearing for HOD's commercial + open-core posture.
- 2026-06-11: Implemented hooks/license-guard.mjs (PreToolUse Bash|PowerShell). Intercepts
  npm install / yarn add / pnpm add / cargo add; looks up license via npm view / crates.io API;
  blocks GPL/LGPL/AGPL/EUPL/SSPL/unlicensed; fails open on network errors (offline safe). Ledger
  convention: THIRD_PARTY_LICENSES file; hook nudges on any permissive add. Escape:
  [allow-license: reason] inline token or CLAUDE_KIT_ALLOW_LICENSE=1 env var. Wired into
  hooks.json + settings.recommended.json (Bash|PowerShell). 21 tests in
  hooks/license-guard.test.mjs; npm test: 119 passed, 0 failed. KIT-T021 files untouched.

## History
- [2026-06-11 06:24] (status) todo → doing
- [2026-06-11 08:00] (status) doing → done
