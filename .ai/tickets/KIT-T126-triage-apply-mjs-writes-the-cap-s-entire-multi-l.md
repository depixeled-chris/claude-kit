---
id: KIT-T126
title: triage apply.mjs writes the cap's ENTIRE multi-line text into the `title:` frontmatter scalar

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
type: bug
status: todo
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:46:37.012Z
updated: 2026-07-14T17:46:37.012Z
---

## Description
triage apply.mjs writes the cap's ENTIRE multi-line text into the `title:` frontmatter scalar

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

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
