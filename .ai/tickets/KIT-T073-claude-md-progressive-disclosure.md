---
id: KIT-T073
title: Progressive disclosure for the global contract — specialist sections become on-demand skills
type: tech-debt
status: todo
priority: low
milestone:
labels: [tokens, contract, skills]
files:
  - user-config/CLAUDE.global.md
links: [KIT-T071]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
The global CLAUDE.md is paid in every session of every project. Its DB & ORM discipline
section (~20 lines) is relevant in a fraction of sessions — exactly what skills'
progressive disclosure is for: a `db-discipline` skill whose one-line description
triggers loading when DB work appears. Apply the same test to other specialist sections
(keep the architecture/working-rules core inline — it's load-bearing everywhere).
Also trim the wordier command/skill/agent descriptions: every description ships in the
system prompt of every session.

## Acceptance Criteria
- [ ] DB & ORM section moved to a skill with a trigger-worthy description; CLAUDE.global.md keeps a one-line pointer.
- [ ] Each remaining section justified as universally load-bearing (note the audit in Notes).
- [ ] Kit command/skill/agent descriptions tightened (before/after token count recorded).
- [ ] Hook enforcement unaffected (DB hooks still fire regardless of skill loading).

## Plan
1. Extract db-discipline skill.
2. Section audit; description trims; token deltas.

## Notes
- 2026-06-09: opened from the token-caching review.
