---
id: KIT-T070
title: Doc rot pass — README, claude-kit SKILL.md, DAILY-LOOP, repo CLAUDE.md; wire doc-audit into release ritual
type: tech-debt
status: done
priority: medium
milestone: M4-one-truth
labels: [docs]
files:
  - README.md
  - skills/claude-kit/SKILL.md
  - skills/README.md
  - agents/README.md
  - docs/DAILY-LOOP.md
  - CLAUDE.md
links: [KIT-T068]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-12T02:40:09Z
---

## Description
The public-facing docs describe a previous generation of the kit:
- README lists 5 of 9 commands and 5 of 23 scripts.
- skills/claude-kit/SKILL.md is the rottenest file on the surface: captures to the
  retired INBOX.md monolith, wrong research/ path, wrong user-config contents, and a
  setup section describing the pre-plugin bootstrap world (contradicts KIT-D013).
- agents/README + skills/README say "bootstrap.sh installs them" (legacy-only).
- DAILY-LOOP.md describes old /prime, never mentions /drain //decide //standup, says
  INBOX, and ends the day with a bare `git commit -am "wip:"` that the commit gate
  would block.
- The repo's own CLAUDE.md workflow section is an older snippet generation than
  project-template/CLAUDE.snippet.md — the kit doesn't dogfood its current contract.
Prevention, not just cure: add a doc-audit step to the release-checklist skill so this
class of rot is caught at publish time.

## Acceptance Criteria
- [x] Every named doc matches current reality (commands, paths, plugin-era install).
- [x] Repo CLAUDE.md regenerated from the current snippet.
- [x] release-checklist includes a doc-audit step (broken refs + stale command lists).
- [x] /doc-audit run clean as the ticket's exit proof.

## Plan
1. Sweep the six files.
2. Regen CLAUDE.md from snippet.
3. release-checklist wiring; final /doc-audit run.

## Notes
- 2026-06-09: opened from the full-plugin review.
- 2026-06-11: doc-rot pass complete. Stale items fixed: README commands list (5→10) + scripts
  comment (5→27); skills/claude-kit/SKILL.md — INBOX.md→inbox/, research/→docs/research/,
  user-config contents, bootstrap.sh→plugin install model, DECISIONS→decisions/; skills/README.md
  + agents/README.md — "bootstrap.sh installs them" → plugin ships them; docs/DAILY-LOOP.md —
  added /drain, /decide, /standup, /status sections; INBOX→inbox/; end-of-day commit fixed (bare
  -am → explicit pathspecs + ticket cite); CLAUDE.md — regenerated workflow section from snippet
  (added provenance-first, evidence floor, KIT-D015 cadence, native-task-sync, history/regression
  tracking, atomic stores sections); fixed stale .ai/INBOX.md ref in snippet + CLAUDE.md (→inbox/).
  release-checklist: added step 8 doc-audit. Final doc-audit sweep: CLEAN — zero broken links,
  zero INBOX.md refs, zero bootstrap.sh-installs refs across all 7 named docs.
  [no-test: documentation reconciliation; verified by a clean doc-audit sweep over the named files]

## History
- [2026-06-12 02:32] (status) todo → doing
- [2026-06-12 02:39] (comment) ticked: Every named doc matches current reality (commands, paths, plugin-era install).
- [2026-06-12 02:39] (comment) ticked: Repo CLAUDE.md regenerated from the current snippet.
- [2026-06-12 02:39] (comment) ticked: release-checklist includes a doc-audit step (broken refs + stale command lists).
- [2026-06-12 02:39] (comment) ticked: /doc-audit run clean as the ticket's exit proof.
- [2026-06-12 02:40] (status) doing → done
