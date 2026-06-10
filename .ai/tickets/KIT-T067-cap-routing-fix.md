---
id: KIT-T067
title: cap routes by cwd-walk and misfiles cross-project captures — fix routing + re-home the strays
type: bug
status: todo
priority: critical
milestone: M3-provenance
labels: [cap, routing, provenance]
files:
  - scripts/cap.mjs
links: [KIT-T065]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
cap.mjs resolves the target project by walking up from cwd (cap.mjs:21-29), so a capture
made while sitting in claude-kit about hustle-or-die lands in KIT's inbox. The live
store demonstrates it: ~16 of the 25 items in claude-kit's inbox are HOD product items
(regressions, requirements, standing decisions). Provenance is only as good as its
root — a misrooted capture corrupts every link built on it. Promotes the inbox capture
`2026-06-06-1813-bug-cap-routes-by-cwd-walk-misroutes-cross-project-captures`.

Fix: explicit project targeting — `cap --project hod ...` / a leading `hod:` token /
match the capture text against the project registry — with cwd-walk only as the
fallback, and the receipt ALWAYS naming the resolved project so a misroute is caught in
three words.

## Acceptance Criteria
- [ ] Explicit project flag/prefix wins over cwd; registry-based name matching proposed when text obviously names another project.
- [ ] Receipt names the destination project every time.
- [ ] The ~16 misfiled HOD items in claude-kit's inbox are re-homed to HOD's store (content-preserving moves, noted in each).
- [ ] Tests: explicit flag, prefix, cwd fallback, cross-project receipt.

## Plan
1. cap.mjs arg/prefix parsing + registry match.
2. Re-home script for the strays.
3. Tests.

## Notes
- 2026-06-09: opened from the full-plugin review; supersedes nothing but PROMOTES the 2026-06-06-1813 inbox capture (delete/mark that cap at triage, citing this id).
