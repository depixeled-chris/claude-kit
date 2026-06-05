---
type: bug
target: claude-kit
created: 2026-06-04
links: [KIT-T009]
---
(bug) `scripts/next-id.mjs` FAILED in the HOD project — the .ai config uses `prefix: HOD-T` but the
script expects an `ids.key`. Agents fall back to scanning tickets (max+1), which works but defeats
the programmatic allocator + reintroduces the concurrent-collision risk KIT-T009 was meant to fix.
Reconcile next-id.mjs with the actual config shape (prefix vs ids.key). Surfaced by the buildings
breakdown agent allocating HOD-T072-075.
