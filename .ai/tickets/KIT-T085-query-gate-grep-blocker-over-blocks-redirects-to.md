---
id: KIT-T085
title: query-gate grep blocker over-blocks: redirects to code-graph/q.mjs that cannot answer the blocked query (Rust/WGSL symbols unindexed, no content-search mode, config.yml debugging)
type: bug
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-06-11T04:01:40Z
updated: 2026-06-11T21:38:50Z
---

## Description
Maintainer-flagged 2026-06-11 (hustle-or-die session). The query-gate hook
blocks greps and points at tools that cannot answer the blocked query — a
dead end, not a redirect:

1. `grep -rln "terrain" src/render` BLOCKED → `code-graph --query defines
   terrain` returned `[]` → had to fall back to Glob filename guessing.
   code-graph has no content-search mode, so "which file mentions X" has no
   sanctioned answer.
2. `code-graph --query defines set_environment` returned `[]` — Rust (and
   WGSL) symbols are not indexed, but the gate still blocks discovery greps
   in Rust crates.
3. store-grep blocked `grep ids config.yml` while debugging WHY
   `t.mjs new` failed ("no ids.key in …hustle-or-die/.ai/config.yml") —
   q.mjs queries the work graph, not raw config; config debugging has no
   sanctioned path. (Separate bug: t.mjs cannot create HOD tickets because
   that config lacks ids.key — T157 had to be hand-authored.)

## Acceptance Criteria
- [x] code-graph (or the gate's suggestion) covers content search, or the gate allows greps it cannot redirect (e.g. when the index has no hits for the language/path)
- [x] Rust + WGSL symbols indexed, or Rust crates exempt from source-discovery
- [x] reading/diagnosing .ai config.yml is not blocked by store-grep
- [x] t.mjs works against projects whose config lacks ids.key (fix config or fail with the fix instruction)

## Plan
1. Decide policy: fail-open when the index can't answer vs extend coverage.
2. Add content-search passthrough or index Rust/WGSL in code-graph.
3. Exempt .ai/config.yml from store-grep; add ids.key to HOD config (or t.mjs default).

## History
- [2026-06-11 04:01] (created) bug — query-gate grep blocker over-blocks: redirects to code-graph/q.mjs that cannot answer the blocked query (Rust/WGSL symbols unindexed, no content-search mode, config.yml debugging)
- [2026-06-11 21:33] (status) todo → doing
- [2026-06-11 21:38] (comment) ticked: code-graph (or the gate's suggestion) covers content search, or the gate allows greps it cannot redirect (e.g. when the index has no hits for the language/path)
- [2026-06-11 21:38] (comment) ticked: Rust + WGSL symbols indexed, or Rust crates exempt from source-discovery
- [2026-06-11 21:38] (comment) ticked: reading/diagnosing .ai config.yml is not blocked by store-grep
- [2026-06-11 21:38] (comment) ticked: t.mjs works against projects whose config lacks ids.key (fix config or fail with the fix instruction)
- [2026-06-11 21:38] (status) doing → review
- [2026-06-11 21:38] (comment) AC1-3: RULE 2 now exempts non-indexed extensions (Rust .rs, WGSL .wgsl, +others) from source-discovery block — code-graph can't answer those, so blocking was a dead end. JS/TS tree-wide greps still blocked. AC3: grep ids .ai/config.yml already passed via KIT-T080 carve-out — added tests to assert it. AC4: nextId error now names the fix (add ids: key:/pad: to config.yml). 44 gate tests + 124 hook-suite + npm test all green.
