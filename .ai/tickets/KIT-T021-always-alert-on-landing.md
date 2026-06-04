---
id: KIT-T021
title: RIGID — always alert the maintainer when something lands (commit / push / deploy)
type: feature
status: todo
priority: high
labels: [hooks, loop, notifications, enforcement]
links: [KIT-D017, KIT-T019]
files: [hooks/, commands/drain.md]
created: 2026-06-04T12:40:00Z
updated: 2026-06-04T12:40:00Z
---

## Description
A rigid, enforced part of the loop: whenever work LANDS, the maintainer is ALWAYS alerted — never
silent. "Lands" = committed + pushed (and, where applicable, deployed/live). The alert states what
landed, the ticket id, and how to see it (URL/commit). This is not optional or best-effort; it is
structural, like the commit-gate.

## Acceptance Criteria
- [ ] A landing alert fires on every commit/push of real work (not docs-only noise) — what + ticket + link.
- [ ] Where a deploy follows (e.g. Pages-Actions), the alert also confirms when it's LIVE, not just pushed.
- [ ] Enforced (hook on commit/push, or a drain-contract rule the orchestrator cannot skip), not memory.
- [ ] Distinguishes "pushed (building)" from "live (deployed)".

## Notes
- 2026-06-04: Maintainer: "a rigid part of the KIT process re-enforcement needs to be to ALWAYS
  alert me when something lands." Pairs with KIT-T019 (bubble-up) and KIT-D017 (the loop).
