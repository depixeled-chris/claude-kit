---
id: KIT-T143
title: CRX split-brain reconciliation — central copy frozen Jun 15 (9 tickets) vs live in-repo (20, Jul 14); merge or supersede, never clobber
type: bug
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T134]
files: []
supersedes:
superseded_by:
created: 2026-07-23T16:08:36Z
updated: 2026-07-23T16:08:36Z
---

## Description
The one case KIT-T134's reconcile-central correctly REFUSED: client-rx-clinical was
centralized once, then its live .ai reverted to a plain in-repo dir; the central copy
froze 2026-06-15 (9 tickets) while the in-repo store is live (20 tickets, newest
2026-07-14). Until reconciled, CRX is invisible to cross-machine sync and the KIT-T131
hub reads whichever store discovery finds first. Impact is visibility, not data loss —
the live store is safe in the CRX repo.

## Acceptance Criteria
- [ ] Diff central vs in-repo stores: prove whether in-repo is a strict superset (it likely evolved from the central copy) — list any item existing only centrally
- [ ] Reconcile: live in-repo content becomes the central copy (merge in any central-only items first), junction restored, .ai gitignored in the repo — via a guarded reconcile-central mode, not ad-hoc moves
- [ ] Re-run `node scripts/reconcile-central.mjs` reports CRX as SKIP (junctioned); claude-kit-data + CRX repo pushed
- [ ] The divergence path is test-covered (central-only item survives a merge)

## Plan
1. Diff the two ticket sets (ids + newest mtimes).
2. Extend reconcile-central with an explicit merge mode for the both-exist case.
3. Execute for CRX; verify idempotent SKIP.

## History
- [2026-07-23 16:08] (created) bug — CRX split-brain reconciliation — central copy frozen Jun 15 (9 tickets) vs live in-repo (20, Jul 14); merge or supersede, never clobber
