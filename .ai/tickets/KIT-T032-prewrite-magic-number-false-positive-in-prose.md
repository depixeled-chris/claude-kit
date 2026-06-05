---
id: KIT-T032
title: "pre-write magic-number check false-positives on prose inside string literals/comments"
type: bug
status: todo
priority: medium
milestone:
labels: [hooks, pre-write, false-positive, dx]
links: [KIT-D021]
aka: []
files:
  - hooks/pre-write.mjs
created: 2026-06-04T00:00:00Z
updated: 2026-06-04T00:00:00Z
---

## Description
`hooks/pre-write.mjs`'s magic-number check scans string-literal and comment content, not
just code. Editing `hooks/orient.mjs` (whose IDENTITY/PROCESS-RULES blocks are a prose
heredoc) was BLOCKED because documentation text contained "60-75k", "70k", and "5-line".
These are prose, not code constants — a false positive. It forced a reword to dodge the
check (KIT-D021 work). The check should ignore numbers inside string literals and comments
and only flag bare numerics in executable code.

## Acceptance Criteria
- [ ] The magic-number check ignores numerics inside string literals (incl. template
      literals / heredocs) and comments; still flags bare magic numbers in code.
- [ ] A regression test: a file with numbers in prose/strings passes; a file with a bare
      code constant (outside the allowed -1,0,1,2) still fails.
- [ ] Re-running the original `hooks/orient.mjs` prose (with the numbers restored) passes.

## Notes
- 2026-06-04: Surfaced while encoding the delegation refinement into orient.mjs (KIT-D021).
  Worked around by removing the numerals from the prose; root cause not yet fixed.
