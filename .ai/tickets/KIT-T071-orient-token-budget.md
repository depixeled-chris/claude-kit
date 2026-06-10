---
id: KIT-T071
title: orient on a token budget — gist + q-pointers instead of full dumps
type: tech-debt
status: todo
priority: medium
milestone:
labels: [hooks, tokens, caching]
files:
  - hooks/orient.mjs
links: [KIT-T048]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T03:10:00Z
---

## Description
Orientation injected 12.7KB (~3.2k tokens) this session — written to prompt cache at
1.25x every session start, re-read at 0.1x every turn, and re-paid IN FULL after every
/clear or compact. KIT-T048 already established the right pattern (token-frugal gist +
drill-in clue via q trail); apply it to orientation itself: commits/WIP/SESSION as a
tight gist; lineage, governing items, and the full standing-decisions text collapsed to
one-line pointers resolvable on demand through q. The kit's anti-amnesia design makes
/clear correct — a lean orient is what makes it cheap.

## Acceptance Criteria
- [ ] Hard token budget for orient output (target ≤1.2k tokens), enforced in code with per-section caps.
- [ ] Standing decisions: scope-filtered ones stay; the rest collapse to `q` pointers (KIT-T046 behavior kept).
- [ ] Lineage + governing sections become pointers with a one-line gist each.
- [ ] Orientation regression test asserts the budget on a representative fixture store.

## Plan
1. Per-section budgets + gist formatting.
2. Pointer lines with exact q commands.
3. Fixture test.

## Notes
- 2026-06-09: opened from the token-caching review. Cross-session prefix reuse is dead anyway (harness injects volatile gitStatus into the system prompt) — the win is per-session size, not reordering.
