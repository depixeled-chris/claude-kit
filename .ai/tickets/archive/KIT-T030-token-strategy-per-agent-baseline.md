---
id: KIT-T030
title: "TOKEN STRATEGY — cut the per-agent baseline ingestion (subagents start at 58-76k before any work)"
type: feature
status: done
priority: critical
labels: [tokens, agents, context, performance, strategy]
links: [KIT-T020, KIT-T004, KIT-T026, KIT-T029, KIT-D015]
files: [agents/, hooks/, docs/]
created: 2026-06-04T17:10:00Z
updated: 2026-06-10T06:00:00Z
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
- 2026-06-04T21:30:00Z: LEVER 1 IMPLEMENTED (claude-kit-controllable parts).
  LANDED in claude-kit:
  • Per-agent `tools:` audited across all 4 agents — already least-privilege, confirmed:
    researcher (Read,Grep,Glob,Bash,WebSearch,WebFetch) + code-reviewer (Read,Grep,Glob,Bash)
    carry NO Edit/Write; refactorer + test-author keep Edit/Write/Bash (need it). No over-grants
    to trim; documented the toolset-as-token-lever rationale in agents/README.md.
  • Digest + pointer (lever 1, option 2 — the full-CLAUDE.md-inheritance replacement claude-kit
    DOES control): added a short "Operating context (lean)" block to all 4 agent bodies — a
    handful of invariants + "read the relevant CLAUDE.md section on demand" in place of relying
    on the whole global+project contract. ~0.3k digest replaces RELIANCE on ~7–30k always-on.
  • Documented controllable-vs-harness split precisely in docs/research/agent-token-strategy.md
    (new "What's claude-kit-controllable vs harness-level" section) + agents/README.md.
  HARNESS-LEVEL (NOT claude-kit-controllable — flagged, not faked):
  • Skills-catalog injection into subagents (~8–14k, biggest single bucket) — no agent-frontmatter
    knob; needs a harness setting (per-agent "no skills" / global "subagents omit skills catalog").
  • Global+project CLAUDE.md AUTO-injection into subagents (~9.4k + up to ~20k) — digest reduces
    reliance but can't stop the harness injecting it; needs a harness "subagents skip CLAUDE.md" toggle.
  • Doubled memory index (~0.6k): redundancy = project `@.claude/memory/MEMORY.md` import + harness
    machine-local auto-memory injection. BOTH live outside claude-kit (the `@import` is in the
    CONSUMING project's CLAUDE.md, e.g. HOD's; the auto-inject is harness). Symlink makes them
    byte-identical but still injected twice. Clean dedup = once auto-memory is symlinked to the
    committed `.claude/memory/`, DROP the project CLAUDE.md `@import` (redundant) — that edit
    belongs in each consuming project. claude-kit's template never added the `@import`, so nothing
    to remove here.
  VERIFY: `npm test` green (23+19+18+15 passed, 0 failed); no hook file touched (only agents/* +
    docs/research/agent-token-strategy.md changed). Expected baseline cut from the controllable
    parts alone is modest (~0.3–2k of digest/toolset trim); the projected 35–45% requires the
    three harness-level injections above — surfaced for a harness-capability decision.
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
