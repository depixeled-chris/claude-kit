---
id: KIT-T069
title: Config truth — reconcile template vs repo config, hooks.json vs settings.recommended, remove vapor knobs
type: tech-debt
status: todo
priority: high
milestone: M4-one-truth
labels: [config, contract]
files:
  - project-template/.ai/config.yml
  - .ai/config.yml
  - hooks/hooks.json
  - user-config/settings.recommended.json
links: [KIT-T068]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Config has drifted in BOTH directions and promises software that doesn't exist:
- Template lacks `statuses.off_board` (KIT-T024) — yet ships supersede frontmatter that
  depends on it — and lacks the entire `capture:` request-gate block, so adopters can't
  see or tune the Stop gate.
- Repo's own config lacks the template's `roadmap_mode` and `watch_repos`.
- hooks.json claims to mirror settings.recommended.json but wires query-gate + ingest-data
  that the legacy file lacks (a LINK_TOOLING=1 install silently runs without the
  retrieval gate); its $comment still describes the pre-plugin world.
- Vapor (decided 2026-06-09, remove/slim): delete the `drain.groomer` knob until an
  implementation exists; slim `native_task_sync` to what /work actually does (mirror
  criteria into native tasks) and drop the unused sync-tasks.mjs machinery from the spec.

## Acceptance Criteria
- [ ] Template and repo config carry the same schema (off_board, capture, roadmap_mode, watch_repos reconciled deliberately, not blindly copied).
- [ ] hooks.json and settings.recommended.json agree; the mirror $comment is true (or the legacy file is retired with a migration note).
- [ ] groomer knob removed; native_task_sync slimmed; GLOSSARY/STRATEGY references updated.
- [ ] A drift check exists (test or release-checklist step) comparing template config keys to repo config keys.

## Plan
1. Schema diff + deliberate reconcile.
2. hooks.json/settings sync.
3. Vapor removal; drift check.

## Notes
- 2026-06-09: opened from the full-plugin review; vapor disposition decided by Chris (remove/slim).
