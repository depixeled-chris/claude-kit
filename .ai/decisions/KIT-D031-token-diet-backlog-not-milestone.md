---
id: KIT-D031
title: Token-diet work is backlogged, scheduled only after the integrity + closure milestones
date: 2026-06-09
supersedes:
source: conversation 2026-06-09 (token-caching review)
---

**Decision:** The token/caching work (KIT-T071 orient budget, KIT-T072 hook quieting,
KIT-T073 CLAUDE.md progressive disclosure) sits in the UNSCHEDULED backlog — no
milestone — until M1-gate-integrity through M4-one-truth land.

**Why:** It's real money (orient alone ~3.2k tokens re-paid every session/clear/compact)
but nothing corrupts if it waits, whereas the gate bugs lie (sync-data false receipts),
leak (PowerShell commit bypass), and the closure gap actively rots the store. Priority
follows damage, not savings. Rejected: making it M5 now (drain would reach it before
re-prioritization is possible); dropping it (the cost is real and recurring).
