---
id: KIT-T077
title: Magic-number gate precision — stop blocking named values, data rows, radix args, regex literals
type: bug
status: done
priority: high
milestone:
labels: [hooks, gates, false-positives]
files:
  - hooks/pre-write.mjs
  - scripts/test-hooks.mjs
links: [KIT-T032, KIT-T051]
supersedes:
superseded_by:
created: 2026-06-10T07:10:00Z
updated: 2026-06-10T07:10:00Z
---

## Description
Maintainer: "take a look at the magic number hook and make sure that's not overly
aggressive." Probed 9 common idioms; 4 false-positive classes confirmed BLOCKING:
1. Data rows inside a multi-line `const` initializer (`  1920,` — the declaration skip
   is line-anchored, continuation lines aren't covered).
2. Named default parameters (`function f(attempts = 5)` — the name documents the value;
   the name= skip only matched at line start).
3. Mid-line named assignment (`opts.timeout = 5000` — same anchor problem).
4. `parseInt(s, 10)` / `n.toString(16)` radix args (idiomatic, never extracted).
Plus intermittent: regex-literal quantifiers (`/\d{4}/`) — codeOnly doesn't blank regex
literals, so a regex whose FIRST numeral is >2 blocks.

NOT softened (true positives per the rule's intent, kept blocking): bare division
(`x / 3`), magic array index (`a[3]`), inline HTTP codes (`=== 404`). And the check
STAYS A BLOCK — KIT-T051's philosophy ("halts in anything but exclusions; magic numbers
especially STAY a block") is settled; this ticket is precision, not severity.

## Acceptance Criteria
- [x] Pure data rows (digits/punctuation only) inside multi-line initializers pass.
- [x] `name = <num>` / `name: <num>` anywhere on the line passes (not just line start); comparisons (`===`, `>=`) do NOT trigger the skip.
- [x] `parseInt(..., <radix>)` and `.toString(<radix>)` lines pass.
- [x] codeOnly blanks regex literals (conservative: only when `/` follows an operator/opener; bails to division-semantics on newline) — `/\d{4}/` passes, `x / 3` still blocks.
- [x] Non-regression: bare magic numbers, division, array index, HTTP codes still block; full suite green.

## Plan
1. Three line-skip rules in the magic-number section.
2. Regex-literal scanner in codeOnly (prev-char context, in-class tracking, newline bail).
3. Probe cases become permanent tests.

## Notes
- 2026-06-10: opened from maintainer interjection; probe script results recorded above.
- 2026-06-10: implemented. Three precision skips in the magic-number section (data row /
  named-value-anywhere with comparison lookarounds / radix args) + a conservative
  regex-literal scanner in codeOnly: `/` opens a regex only after an operator-opener
  char OR a keyword (`return`, `case`, …; word buffer survives whitespace — the one
  red-green iteration this took), tracks char-classes, bails to division semantics if no
  closing `/` before the newline. Probe now: all 5 FP classes pass; division, array
  index, and `=== 404` still block (true positives — naming an HTTP status is genuinely
  better). 8 permanent tests added; 72/72 + full suite green.
- 2026-06-10: (status) doing -> done — closed by agent per KIT-D034 (uat: none).
  Evidence: the 8 KIT-T077 tests + full-suite run in this commit.
