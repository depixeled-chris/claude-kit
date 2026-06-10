---
id: KIT-T070
title: Doc rot pass — README, claude-kit SKILL.md, DAILY-LOOP, repo CLAUDE.md; wire doc-audit into release ritual
type: tech-debt
status: todo
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
updated: 2026-06-10T03:10:00Z
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
- [ ] Every named doc matches current reality (commands, paths, plugin-era install).
- [ ] Repo CLAUDE.md regenerated from the current snippet.
- [ ] release-checklist includes a doc-audit step (broken refs + stale command lists).
- [ ] /doc-audit run clean as the ticket's exit proof.

## Plan
1. Sweep the six files.
2. Regen CLAUDE.md from snippet.
3. release-checklist wiring; final /doc-audit run.

## Notes
- 2026-06-09: opened from the full-plugin review.
