---
id: KIT-T074
title: maintenance-gaps gets a drain path — nags without resolution train you to ignore them
type: tech-debt
status: todo
priority: medium
milestone:
labels: [hooks, housekeeping, lifecycle]
files:
  - hooks/housekeeping.mjs
links: [KIT-T062]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-12T14:55:33Z
---

## Description
maintenance-gaps.log has fired for 7+ days with zero resolutions (780 lines, ~20 distinct
project x tool pairs) — including eslint missing in claude-kit ITSELF, the enforcement
repo failing its own tooling check. A nag stream with no drain path becomes noise.
Give gaps the same treatment as every other capture: a triage route (each distinct gap
becomes an inbox item / ticket in the right project, or an explicit `.claude-tooling-ok`
acknowledgment), plus dedup so one gap = one entry, not one per session. And actually
fix the flagship embarrassment: install eslint in claude-kit.

## Acceptance Criteria
- [ ] Distinct gaps are deduped (project x tool), with first-seen/last-seen, not an append-only event stream.
- [ ] Each gap is resolvable: tool installed, or `.claude-tooling-ok` entry with reason — and resolution clears the nag.
- [ ] HOD agent-worktrees stop counting as distinct projects in the gap log.
- [ ] eslint installed + configured in claude-kit; its ~40 hits clear.

## Plan
1. Dedup/aggregate the log format.
2. Resolution paths + nag clearing.
3. Fix claude-kit's own eslint gap.

## Notes
- 2026-06-09: opened from the full-plugin review.

## History
- [2026-06-12 14:52] (status) todo → doing
- [2026-06-12 14:55] (status) doing → todo
- [2026-06-12 14:55] (comment) Deferred: gap WRITER logGap()+MAINT_LOG live in hooks/lib.mjs — the paused KIT-T021 session's file on this shared checkout. Criterion 1 (write-time dedup format) and the eslint sweep both touch lib.mjs; editing now reintroduces the multi-agent collision. eslint half split to KIT-T089. Resume both once KIT-T021 lands.
