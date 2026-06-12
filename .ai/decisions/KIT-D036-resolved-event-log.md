---
id: KIT-D036
title: "cap --done writes to .ai/resolved/ (Option A) — resolved-without-ticket items are events, not inbox captures"
date: 2026-06-12
supersedes:
source: maintainer questionnaire 2026-06-12 (KIT-T013 design question); governs KIT-T013
links: [KIT-T013, KIT-D009]
---

**Decision:** Items already handled before being ticketed are logged as resolved events in
`.ai/resolved/` — a dedicated one-file-per-event directory outside the inbox triage queue.
`cap --done <text>` and `cap --done <type> <text>` write there; no-`--done` cap is unchanged.

The record format reuses the same slug/date filename scheme as a normal cap (`YYYY-MM-DD-HHMM-<slug>.md`)
and adds a `resolved: <iso-timestamp>` line to carry the resolution time. `id-utils`
excludes `resolved` from `NON_STORE_DIRS` so its files are never counted as open work.

**Why — inbox = open queue invariant (KIT-D009):** The point of `inbox/` is that every item
there needs attention. If fixed-and-deployed items pile up in inbox (as happened during
gridiron-blitz dogfooding: 7 un-triaged captures, 3 already resolved), the count of
"open" work is a lie. A dedicated `resolved/` folder preserves the invariant by construction
rather than by discipline.

**Rejected:**
- **Option B — write to `notes/` as a resolved note**: conflates "durable reference note"
  with "event log". Notes are timeless; a resolved event is a dated audit trail item.
- **Option C — write to `inbox/` with a `(done)` marker**: still routes through triage
  (the thing the feature exists to avoid), and the drain must learn to skip it — more
  machinery for a simpler invariant than just keeping the dir separate.
