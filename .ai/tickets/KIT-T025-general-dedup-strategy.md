---
id: KIT-T025
title: General deduplication strategy across the whole workflow (capture → inbox → tickets → decisions → memory)
type: feature
status: todo
priority: high
labels: [dedup, capture, tickets, decisions, memory, strategy]
links: [KIT-T024, KIT-D017, KIT-D018]
files: [scripts/, hooks/, commands/]
created: 2026-06-04T15:05:00Z
updated: 2026-06-04T15:05:00Z
---

## Description
KIT-T024 adds the ticket supersede MECHANIC; this is the STRATEGY around it — a coherent,
system-wide approach so duplicates don't accumulate in ANY store. Needs design (research-first):
- **Similarity detection**: how to recognize a near-duplicate (title/label/file/topic overlap;
  cheap text similarity; later embeddings) at the moment of capture AND in a periodic sweep.
- **Canonicalization**: one canonical item; others link/merge/supersede to it. Define the flow per
  store — inbox items, tickets (KIT-T024 supersede), decisions (supersedes:), memory files.
- **At capture vs on triage vs sweep**: when each runs; what's automatic vs operator-confirmed.
- **No silent loss**: merging/superseding must preserve the content trail (per memory hygiene —
  present, don't silently prune).

## Acceptance Criteria
- [ ] A design doc: the unified dedup strategy across all stores, with the detection method, the
      merge/link/supersede flows per store, and where it runs (capture/triage/sweep). Maintainer review.
- [ ] Reconciled with KIT-T024 (tickets), decisions' `supersedes:`, and memory hygiene (no silent prune).
- [ ] Should be designed TOGETHER with KIT-T023 (active context surfacing) and KIT-T024 — one
      coherent "context + dedup integrity" design, not three fragmented ones (ironically, avoid dup effort).

## Notes
- 2026-06-04: Maintainer: "Some kind of deduping strategy in general is also necessary."
