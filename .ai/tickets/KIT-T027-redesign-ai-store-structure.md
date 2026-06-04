---
id: KIT-T027
title: "Redesign the .ai store structure as first-class KIT-owned machinery (item model; reassess `notes`; triage/backlog as plugin code)"
type: feature
status: todo
priority: high
labels: [schema, store, triage, backlog, plugin, design]
links: [KIT-T004, KIT-T023, KIT-T024, KIT-T025, KIT-T026, KIT-D012]
files: [.ai/, scripts/, commands/]
created: 2026-06-04T15:55:00Z
updated: 2026-06-04T15:55:00Z
---

## Description
Maintainer: the `.ai` notes structure feels ad-hoc/"outside what we're doing," and "everything about
backlog triage etc. looks like KIT domain." Agreed — triage/backlog/inbox/drain/statuses/notes are
WORKFLOW MACHINERY owned by the plugin, not per-project hand-management. The project should hold only
its DATA (tickets/decisions); the STRUCTURE + mechanics should be first-class KIT code.

Redesign goals (research/design first):
- **Keep markdown-as-truth** (git-diffable, synced, human-readable, no hard DB dep) — that principle stays.
- **One clean item model** aligned to the schema the SQLite cache already defines (KIT-T004:
  items/links/artifacts/history). The stores should be a serialization of that model, not loose folders.
- **Reassess `notes`** — it overlaps `inbox` (freeform capture); decide: merge into inbox, or give it
  a distinct, defined role. Eliminate the ad-hoc bucket.
- **Triage/backlog/drain as plugin-owned code** (consistent across all adopting projects), not per-project
  improvisation — folds with KIT-T024/T025 (dedup/supersede), KIT-T026 (consume the cache), KIT-T023
  (active surfacing). This is the "context + workflow integrity" redesign as one coherent piece.

## Acceptance Criteria
- [ ] Design doc: the item model + store layout (what stays markdown, what `notes` becomes), the
      triage/backlog/drain mechanics as plugin code, migration from today's stores. Maintainer review.
- [ ] Reconciled with markdown-as-truth + the SQLite schema (KIT-T004) + dedup/supersede (T024/T025).

## Notes
- 2026-06-04: Maintainer flagged the notes structure + that backlog/triage is KIT domain. Design TOGETHER
  with the T023/T024/T025/T026 cluster — one coherent KIT data/workflow redesign, not piecemeal.
