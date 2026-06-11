---
id: KIT-T071
title: orient on a token budget — gist + q-pointers instead of full dumps
type: tech-debt
status: done
priority: medium
milestone:
labels: [hooks, tokens, caching]
files:
  - hooks/orient.mjs
links: [KIT-T048]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-11T22:30:00Z
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
- [x] Hard token budget for orient output (target ≤1.2k tokens), enforced in code with per-section caps.
- [x] Standing decisions: scope-filtered ones stay; the rest collapse to `q` pointers (KIT-T046 behavior kept).
- [x] Lineage + governing sections become pointers with a one-line gist each.
- [x] Orientation regression test asserts the budget on a representative fixture store.

## Plan
1. Per-section budgets + gist formatting.
2. Pointer lines with exact q commands.
3. Fixture test.

## Notes
- 2026-06-09: opened from the token-caching review. Cross-session prefix reuse is dead anyway (harness injects volatile gitStatus into the system prompt) — the win is per-session size, not reordering.

## Notes
- 2026-06-11: implemented. SESSION/ROADMAP gisted (6 + 8 lines inline, pointer for rest). Decisions dir: latest 6 ids + `q decisions` pointer. Lineage: count+roles + `read .ai/lineage.yml` pointer. Governing: count-only + `q governing` pointer. IDENTITY block trimmed to 7 essential bullets. Commits: 12→6. Budget result: ~442 tokens on a fat fixture (budget 1200). 12 new test assertions, 136 total passed.

## History
- [2026-06-11 21:41] (status) todo → doing
- [2026-06-11 22:30] (status) doing → done
