---
id: KIT-T021
title: RIGID — always alert the maintainer when something lands (commit / push / deploy)
type: feature
status: done
priority: high
labels: [hooks, loop, notifications, enforcement]
links: [KIT-D017, KIT-T019]
files: [hooks/, commands/drain.md]
created: 2026-06-04T12:40:00Z
updated: 2026-06-15T15:59:20Z
---

## Description
A rigid, enforced part of the loop: whenever work LANDS, the maintainer is ALWAYS alerted — never
silent. "Lands" = committed + pushed (and, where applicable, deployed/live). The alert states what
landed, the ticket id, and how to see it (URL/commit). This is not optional or best-effort; it is
structural, like the commit-gate.

## Acceptance Criteria
- [x] A landing alert fires on every commit/push of real work (not docs-only noise) — what + ticket + link.
- [x] Where a deploy follows (e.g. Pages-Actions), the alert also confirms when it's LIVE, not just pushed.
- [x] Enforced (hook on commit/push, or a drain-contract rule the orchestrator cannot skip), not memory.
- [x] Distinguishes "pushed (building)" from "live (deployed)".

## Notes
- 2026-06-04: Maintainer: "a rigid part of the KIT process re-enforcement needs to be to ALWAYS
  alert me when something lands." Pairs with KIT-T019 (bubble-up) and KIT-D017 (the loop).
- 2026-06-15: CLOSED. hook complete (hooks/land-alert.mjs, 223 lines — landedThisTurn/isRealWork/
  isPushed/renderAlert, keyed 'land' turn-state dedup, LANDED_RECEIPT release valve, fail-open,
  block-once exit 2). Registered as LAST Stop hook in both hooks.json and
  user-config/settings.recommended.json (parity per KIT-T069). Test: hooks/land-alert.test.mjs
  12/12 PASS (block, allow-receipt, allow-deployed, allow-no-alert, allow-stop_hook_active,
  allow-no-commit-this-turn, allow-docs-only, allow-unadopted, allow-missing-transcript,
  dedup-first-blocks, dedup-second-silent, allow-ticket-cite-only). npm test exit 0 (all suites).
  drain.md: DEPLOY-CONFIRM RULE added — pushed≠live, must confirm deploy is LIVE before closing.
  Completing this ticket FREES lib.mjs for gated tickets (T074/T089/T090/T003-tail).

## History
- [2026-06-11 05:30] (status) todo → doing
- [2026-06-11 05:37] (status) doing → todo
- [2026-06-15 15:53] (status) todo → doing
- [2026-06-15 15:58] (comment) ticked: A landing alert fires on every commit/push of real work (not docs-only noise) — what + ticket + link.
- [2026-06-15 15:58] (comment) ticked: Where a deploy follows (e.g. Pages-Actions), the alert also confirms when it's LIVE, not just pushed.
- [2026-06-15 15:58] (comment) ticked: Enforced (hook on commit/push, or a drain-contract rule the orchestrator cannot skip), not memory.
- [2026-06-15 15:58] (comment) ticked: Distinguishes "pushed (building)" from "live (deployed)".
- [2026-06-15 15:59] (status) doing → done
