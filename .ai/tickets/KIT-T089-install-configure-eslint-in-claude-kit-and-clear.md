---
id: KIT-T089
title: Install + configure eslint in claude-kit and clear its ~40 hits (split from KIT-T074)
type: tech-debt
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-06-12T14:55:01Z
updated: 2026-06-12T14:55:01Z
---

## Description
Split from KIT-T074 (maintenance-gaps drain). The enforcement repo fails its own
tooling check: eslint is missing in claude-kit, generating ~40 maintenance-gap hits.
This is the eslint half — install + configure eslint and clear its hits.

Split off because clearing the hits means an `eslint --fix` / edit sweep across the
repo's `.mjs`, which would rewrite `hooks/lib.mjs` — currently OWNED by the paused
KIT-T021 session on this shared checkout. Running it now reintroduces the exact
multi-agent shared-FS collision (maintainer, 2026-06-12). BLOCKED on KIT-T021 landing
(lib.mjs free) before this can run.

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ] eslint + a flat config installed in claude-kit (devDependency + eslint.config.js), lint script wired into package.json.
- [ ] The ~40 existing hits cleared (auto-fixable via `--fix`; the rest by hand or an explicit rule disable with reason).
- [ ] `npm run lint` exits clean; the maintenance-gap nag for claude-kit's eslint clears.
- [ ] No edit to `hooks/lib.mjs` lands while KIT-T021 is open (do this AFTER it merges).

## Plan
1. Wait for KIT-T021 to land (frees lib.mjs on the shared checkout).
2. Add eslint + flat config + lint script; run `--fix`; resolve the residue.

## History
- [2026-06-12 14:55] (created) tech-debt — Install + configure eslint in claude-kit and clear its ~40 hits (split from KIT-T074)
