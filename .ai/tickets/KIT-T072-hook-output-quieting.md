---
id: KIT-T072
title: Quiet the per-turn hook chatter — dedupe advisories, conditional receipts
type: tech-debt
status: todo
priority: low
milestone:
labels: [hooks, tokens]
files:
  - hooks/lint.mjs
  - hooks/jscpd.mjs
  - hooks/sync-data.mjs
links: [KIT-T053]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Appended hook output never invalidates the prompt-cache prefix (the architecture is
cache-safe by construction) but it compounds linearly over a long session: lint/jscpd
advise on every edit, repeating per file; sync-data prints a receipt every Stop even
when nothing changed (fixed for honesty in KIT-T053; this ticket is the volume side).
Dedupe advisory output to once-per-file-per-session and emit receipts only when
something happened.

## Acceptance Criteria
- [ ] lint/jscpd advisories for an unchanged finding on the same file emit once per session (session-scoped marker file or mtime check), not per edit.
- [ ] sync-data/code-graph/hydrate-cache emit nothing on no-op turns.
- [ ] Warnings that DO fire stay complete (no truncating real signal to save tokens).

## Plan
1. Session-scoped dedup cache for advisories.
2. No-op silence sweep across Stop hooks.

## Notes
- 2026-06-09: opened from the token-caching review.
