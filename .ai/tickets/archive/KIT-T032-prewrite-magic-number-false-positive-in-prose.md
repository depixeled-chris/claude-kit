---
id: KIT-T032
title: "pre-write magic-number check false-positives on prose inside string literals/comments"
type: bug
status: done
priority: medium
milestone:
labels: [hooks, pre-write, false-positive, dx]
links: [KIT-D021]
aka: []
files:
  - hooks/pre-write.mjs
  - scripts/test-hooks.mjs
created: 2026-06-04T00:00:00Z
updated: 2026-06-10T06:00:00Z
---

## Description
`hooks/pre-write.mjs`'s magic-number check scans string-literal and comment content, not
just code. Editing `hooks/orient.mjs` (whose IDENTITY/PROCESS-RULES blocks are a prose
heredoc) was BLOCKED because documentation text contained "60-75k", "70k", and "5-line".
These are prose, not code constants — a false positive. It forced a reword to dodge the
check (KIT-D021 work). The check should ignore numbers inside string literals and comments
and only flag bare numerics in executable code.

## Acceptance Criteria
- [x] The magic-number check ignores numerics inside string literals (incl. template
      literals / heredocs) and comments; still flags bare magic numbers in code.
- [x] A regression test: a file with numbers in prose/strings passes; a file with a bare
      code constant (outside the allowed -1,0,1,2) still fails.
- [x] Re-running the original `hooks/orient.mjs` prose (with the numbers restored) passes.

## Notes
- 2026-06-04: Surfaced while encoding the delegation refinement into orient.mjs (KIT-D021).
  Worked around by removing the numerals from the prose; root cause not yet fixed.
- 2026-06-05: Fixed. Mirrors the KIT-T033 precision approach — the rule is unchanged; the
  scan just stops seeing non-code. Added `codeOnly(src)` to `hooks/pre-write.mjs`: a single
  forward character scan that blanks every NON-code span to spaces while preserving newlines
  (so line numbers stay true), spanning multi-line template literals/heredocs and `/* */`
  blocks — the exact case that leaked `60-75k`/`70k`/`5-line` from orient.mjs's prose
  heredoc. Covers `"…"`/`'…'`/`` `…` `` (with `\` escapes), `//`/`#`/`--` line comments, and
  `/* */` blocks. The magic-number scan now reads the blanked line; numerics that survive are
  real code constants. Declaration/`name:` skips stay keyed to the original line, so a bare
  constant with a trailing comment (`return x * 1337; // …`) still FAILS. Fail-open preserved
  (any throw caught by the caller). +4 regression tests in `scripts/test-hooks.mjs`
  (template-literal heredoc, line comment, block comment → PASS; bare constant amid prose
  numbers → still BLOCK). Verified the restored orient.mjs prose passes. Full suite green:
  test-hooks 27/0 (was 23), request-gate ALL PASS, ingest-data 5/0, id-utils 19/0,
  code-graph 18/0, db-cache 58/0, triage 3/0; `npm test` exit 0.
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
