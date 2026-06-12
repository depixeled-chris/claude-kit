---
id: KIT-T023
title: "SYSTEM PROBLEM — the durable record is passive; it must actively surface + connect relevant context at decision points"
type: feature
status: doing
priority: critical
labels: [system, context, memory, hooks, provenance, orient]
links: [KIT-D015, KIT-D017, KIT-D018, KIT-T019]
files: [hooks/orient.mjs, hooks/pre-write.mjs, commands/drain.md]
created: 2026-06-04T13:30:00Z
updated: 2026-06-12T17:56:08Z
---

## Description
ROOT failure observed 2026-06-04: the record HAD the answer (`rust-world-architecture` memory:
TS sim is legacy, Rust/WASM is the product runtime) and the orchestrator still (a) fixed the legacy
TS sim, (b) inverted it into agent guards, (c) built a "right context" linchpin (HOD-T063) without
ever checking which sim `npm run dev` runs. Hand-repairing each memory is patching the symptom. The
SYSTEM defect: the durable record is WRITE-AND-INDEX (a fixed block dumped at session start), not
SURFACE-AND-CONNECT. It is not operative at the moment of a decision or in an agent handoff.

## Candidate directions (to look at — research/design first)
- **Topical active surfacing:** on touching a file/area (e.g. editing `src/sim/`), a hook injects
  the relevant memories/decisions (keyed by path/topic/links), so the governing record is in front
  of the actor, not buried in an index.
- **Runtime-reality in orient:** orient DERIVES and states the actual runtime config from the
  code/env (which sim via VITE_SIM, build flags, what `npm run dev` actually runs) — facts, not
  memory — so "what the user sees" is never assumed.
- **Provenance reaches agents by construction:** the SYSTEM injects the relevant record into
  handoffs (KIT-D018/T018), instead of relying on the human-authored prompt (which inverted it here).
- **Cross-links operative:** `[[links]]` / ticket `links:` are traversed + surfaced, not passive.

## Acceptance Criteria
- [ ] A research/design doc analyzing WHY the trail failed + the surfacing mechanisms above, with a phased plan.
- [ ] Maintainer review (this is a "look at the system" ask, not a quick fix).

## Notes
- 2026-06-04: Maintainer: "If you have to repair the trail, there is a SYSTEM PROBLEM we need to
  look at." This is THE claude-kit defect — bigger than any single HOD bug.
- 2026-06-12: Design doc written (with KIT-T025, as a single coherent design per AC-3): `docs/research/context-and-dedup-integrity.md` — covers the trail-failure root cause, all four surfacing mechanisms, phased plan, open questions. Ready for maintainer review.

## History
- [2026-06-12 17:56] (status) todo → doing
