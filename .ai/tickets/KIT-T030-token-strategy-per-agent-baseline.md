---
id: KIT-T030
title: "TOKEN STRATEGY — cut the per-agent baseline ingestion (subagents start at 58-76k before any work)"
type: feature
status: review
priority: critical
labels: [tokens, agents, context, performance, strategy]
links: [KIT-T020, KIT-T004, KIT-T026, KIT-T029, KIT-D015]
files: [agents/, hooks/, docs/]
created: 2026-06-04T17:10:00Z
updated: 2026-06-04T20:09:00Z
---

## Description
Symptom (maintainer, top priority): freshly-dispatched background subagents sit at ~58-76k tokens
IMMEDIATELY, before doing work. The dominant cost is the per-agent BASELINE context, not the task.
Find where it goes and cut it. Suspected contributors:
- global `~/.claude/CLAUDE.md` (the full engineering contract) + project CLAUDE.md + the appended `.ai`
  workflow contract,
- the `@.claude/memory/MEMORY.md` import pulling in ALL memory files,
- the orient SessionStart hook block (git/SESSION/decisions/lineage) — does it inject into SUBAGENTS,
  which don't need it?
- tool schemas,
- the large docs handoffs point agents to read (audit/research docs).

This is a distinct dimension from KIT-T020 (handoff prompt) — it's the FIXED baseline every agent pays.

## Acceptance Criteria
- [x] Measured breakdown of the ~58-76k baseline (size of each contributor). DON'T inflate by reading
      big docs — measure file sizes / what's injected.
- [x] Ranked levers, e.g.: give SUBAGENTS a lean context (scoped task, not the full global contract +
      all memory + orient); provenance-by-reference + query-the-cache (KIT-T004/T026/T020) vs reading
      whole docs; scoped line-range reads; script handoff (KIT-T029).
- [x] A token-strategy doc (claude-kit docs/research) + a recommended config (what subagents inherit).
- [x] Reconciled with KIT-T020/T004/T026/T029 (no dup — this adds the baseline-context dimension).

## Worklog
- 2026-06-04: status→doing. Maintainer: "Why the fuck are those tasks at 76k/58k IMMEDIATELY … token
  strategy is a top priority, want an agent on it now."
- 2026-06-04T20:09Z: status→review. Wrote docs/research/agent-token-strategy.md. Measured breakdown
  (via `wc -c`, no whole-doc reads): tool schemas ~18-30k + skills catalog ~8-14k dominate; global
  CLAUDE.md 9.4k + HOD CLAUDE.md 20k + KIT CLAUDE.md 4.4k inherited by every subagent; memory index
  injected TWICE (project `@`-import + machine-local auto-memory, byte-identical dup); orient block
  ~2k but TOP-LEVEL ONLY (subagents already skip it). Corrected a ticket suspicion: `@MEMORY.md`
  imports only the ~2.3k INDEX, not the 17 sub-files (28.9k) — those are md links, load on demand;
  memory is not the whale. Top 3 levers: (1) lean subagent profile — drop skills catalog + full
  CLAUDE.md + per-agent `tools:` (~12-25k); (2) provenance-by-ref + query-the-cache, deps KIT-T026
  (~5-15k); (3) scoped line-range reads + structured returns (~3-10k). Projected ~35-45% baseline
  cut/dispatch. Reconciled w/ T020/T004/T026/T029/T028.
