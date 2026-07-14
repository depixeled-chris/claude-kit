---
id: KIT-T124
title: index-tickets.mjs silently fails to parse CRLF ticket frontmatter
type: bug
status: review
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
created: 2026-07-14T17:40:14.730Z
updated: 2026-07-14T17:59:15Z
---

## Description
# index-tickets.mjs silently fails to parse CRLF ticket frontmatter

type: bug
project: groovegrid (found), affects every repo on Windows
captured: 2026-07-14T17:10Z

`readTickets()` extracts frontmatter with `/^---\n([\s\S]*?)\n---/`
(scripts/index-tickets.mjs:56). A ticket whose FIRST line ends `\r\n` (CRLF —
normal on Windows editors / autocrlf checkouts) never matches, so the whole
frontmatter reads as empty and the board renders a junk row: id = filename,
type/status/priority = "—". Two groovegrid tickets (GG-T003, GG-T009) sat
invisible-by-status on the board this way — a review-queue item the drain and
the human /done pass both miss. SILENT failure: no warning is emitted.

Fix: `/^---\r?\n([\s\S]*?)\r?\n---/` + strip `\r` in `field()`/`listField()`
values (`.trim()` already handles trailing `\r`, the delimiter lines are the
real break). Audit the same idiom in db-parse.mjs / q.mjs / t.mjs — t.mjs
WRITES files it read, so it may also preserve/introduce CRLF. Add a
warning when a .md in tickets/ yields no frontmatter (silent junk rows are
how this hid for a month).

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
- [2026-07-14 17:49] (status) superseded → doing
- [2026-07-14 17:59] (status) todo → review
