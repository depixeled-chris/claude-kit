---
id: KIT-T067
title: cap routes by cwd-walk and misfiles cross-project captures — fix routing + re-home the strays
type: bug
status: done
priority: critical
milestone: M3-provenance
labels: [cap, routing, provenance]
files:
  - scripts/cap.mjs
links: [KIT-T065]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-11T03:00:12Z
fixed_commit: 06764b5
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
- [x] Explicit project flag/prefix wins over cwd; registry-based name matching proposed when text obviously names another project.
- [x] Receipt names the destination project every time.
- [x] The ~16 misfiled HOD items in claude-kit's inbox are re-homed to HOD's store (content-preserving moves, noted in each).
- [x] Tests: explicit flag, prefix, cwd fallback, cross-project receipt.

## Plan
1. cap.mjs arg/prefix parsing + registry match.
2. Re-home script for the strays.
3. Tests.

## Notes
- 2026-06-09: opened from the full-plugin review; supersedes nothing but PROMOTES the 2026-06-06-1813 inbox capture (delete/mark that cap at triage, citing this id).
- 2026-06-10: FIXED. cap.mjs now resolves the target store by EXPLICIT targeting that wins over cwd-walk — a `--project <name>` flag and/or a leading `<name>:` token, matched against the registry by project name OR id key (case-forgiving: `hod`/`hustle-or-die`/`HOD`). An unknown `--project` is a hard error (no silent cwd misroute); a `name:` that resolves to no project stays content. When no explicit target is given but the text obviously names another registered project (a `Project: X` marker or the bare name/key), that project is PROPOSED on stderr while cwd still owns the write. The receipt ALWAYS names the resolved project: `captured [(type)] -> <project>/inbox/<file>`. Reuses lib.mjs registry helpers (readRegistry/projectAiDirs). Tests: 10 cap cases added to scripts/test-hooks.mjs (flag, own-arg + fused `name:` prefix with strip, cwd fallback + receipt, cross-project PROPOSE, unknown-flag error, non-project `word:` lead stays content) — full suite 111/111 + `npm test` green. Re-home: 16 strays (terrain/roads/R052/R053-physics/one-rust-core/frozen-TS/crate-layout/lighting — all explicitly "Project: HOD") moved from claude-kit/.ai/inbox to hustle-or-die's store (D:/dev/claude-kit-data/projects/hustle-or-die/inbox, resolved via centralDataRoot, NOT hardcoded), content-preserving (text + mtime kept, one re-home note appended). Verified by inbox count: KIT 31→15, HOD 19→35 (q rundown ticket-by-scope counts unchanged — inbox files aren't tickets; KIT tickets intact at 47, HOD 98). The 15 KIT-tooling captures left behind were correctly NOT moved. The 2026-06-06-1813 promoting capture moved to inbox/triaged/ citing this id. Data-store additions committed+pushed in claude-kit-data; code+removals in claude-kit.

## History
- [2026-06-11 02:47] (status) todo → doing
- [2026-06-11 02:59] (comment) ticked: Explicit project flag/prefix wins over cwd; registry-based name matching proposed when text obviously names another project.
- [2026-06-11 02:59] (comment) ticked: The ~16 misfiled HOD items in claude-kit's inbox are re-homed to HOD's store (content-preserving moves, noted in each).
- [2026-06-11 02:59] (comment) ticked: Receipt names the destination project every time.
- [2026-06-11 02:59] (comment) ticked: Tests: explicit flag, prefix, cwd fallback, cross-project receipt.
- [2026-06-11 03:00] (status) doing → done
