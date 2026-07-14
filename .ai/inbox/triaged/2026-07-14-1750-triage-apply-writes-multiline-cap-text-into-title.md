(bug) triage apply.mjs writes the cap's ENTIRE multi-line text into the `title:` frontmatter scalar

Observed 2026-07-14 applying a 187-cap cross-project triage. Every created item
whose cap text was multi-line landed with the raw text embedded INSIDE the
frontmatter block: `title: <line1>` followed by the remaining cap lines verbatim,
then the real keys (`type:`/`status:`/...). 31 items corrupted across
KIT/HOD/GG/MGP (tickets + one note). Two knock-on effects: (1) a cap starting
`# Heading` yields an EMPTY parsed title — field()'s inline-comment strip eats
`# ...` — so the board shows blank rows; (2) embedded lines that look like keys
(a cap quoting `type:`/`status:`) can poison field() lookups.

Fix in apply.mjs item writer: title must be a ONE-LINE scalar — first non-empty
text line, `#` prefix stripped, whitespace collapsed, length-capped; the full
text belongs ONLY in ## Description (it already lands there — the body was
correct in all 31). Add a written-file validation pass: frontmatter must contain
no blank/non-key lines (would have caught this and the CRLF bug both).

All 31 were hand-repaired 2026-07-14 (status-anchored strip + one-line title);
this ticket is the kit-side root-cause fix + regression test.
