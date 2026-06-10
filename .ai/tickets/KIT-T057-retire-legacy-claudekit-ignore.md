---
id: KIT-T057
title: Retire the legacy whole-repo .claudekit-ignore opt-out in favor of the KIT-T051 exclusion system
type: tech-debt
status: todo
priority: medium
milestone: M1-gate-integrity
labels: [hooks, gates, dx]
files:
  - hooks/pre-write.mjs
  - hooks/README.md
  - user-config/CLAUDE.global.md
links: [KIT-T051]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Two near-identically-named opt-out mechanisms coexist: the legacy `.claudekit-ignore`
ancestor-walk (pre-write.mjs:88-93) silently disables ALL pre-write checks for a repo,
while `.claude-kit-ignore.yaml` (KIT-T051) is the documented, per-check system. The
legacy marker is a blanket bypass that contradicts the "halts in anything but exclusions"
philosophy and confuses adopters.

## Acceptance Criteria
- [ ] Legacy `.claudekit-ignore` ancestor-walk removed from pre-write.
- [ ] Migration shim: when the legacy file is found, warn once with the exact `.claude-kit-ignore.yaml` equivalent (`'*': ['**']` or per-check globs) instead of silently honoring it.
- [ ] Any repo of ours still relying on the legacy marker (graphics/physics repos) gets a committed `.claude-kit-ignore.yaml` equivalent.
- [ ] Docs mention exactly ONE exclusion system.

## Plan
1. Remove walk; add warn-shim.
2. Sweep known repos for the legacy file.
3. Docs.

## Notes
- 2026-06-09: opened from the full-plugin process review.
