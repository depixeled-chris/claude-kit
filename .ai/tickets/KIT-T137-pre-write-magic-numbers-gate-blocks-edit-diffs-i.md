---
id: KIT-T137
title: pre-write magic-numbers gate blocks Edit diffs INSIDE claude-kit-ignore-start/end blocks

Observed 2026-07-16 in groovegrid: editing a numeric tuple line inside an
established `claude-kit-ignore-start magic-numbers` … `end` block (the
*PanelSpec.h placements arrays — every such file wraps them) gets BLOCKED when
applied via the Edit tool, but the identical content applied via Write
(full-file) passes. The hook evidently evaluates the Edit PAYLOAD (old/new
strings) without resolving the surrounding ignore-block scope in the target
file, so per-line context is lost. Effect: anyone editing already-excluded
lines via Edit gets a false block and is pushed toward Write-whole-file (worse
tool for the job) or adding redundant per-line markers.

Fix: pre-write.mjs must locate the edit's position in the CURRENT file text
and honor enclosing start/end markers before flagging, same as it does for
whole-file scans. Repro: any Edit changing a number inside
groovegrid/src/ui/tracks/effect-panels/ContinuumPanelSpec.h placements.
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
model:                 # OPTIONAL override: fable | opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-23T15:42:09.416Z
updated: 2026-07-23T15:42:09.416Z
---

## Description
pre-write magic-numbers gate blocks Edit diffs INSIDE claude-kit-ignore-start/end blocks

Observed 2026-07-16 in groovegrid: editing a numeric tuple line inside an
established `claude-kit-ignore-start magic-numbers` … `end` block (the
*PanelSpec.h placements arrays — every such file wraps them) gets BLOCKED when
applied via the Edit tool, but the identical content applied via Write
(full-file) passes. The hook evidently evaluates the Edit PAYLOAD (old/new
strings) without resolving the surrounding ignore-block scope in the target
file, so per-line context is lost. Effect: anyone editing already-excluded
lines via Edit gets a false block and is pushed toward Write-whole-file (worse
tool for the job) or adding redundant per-line markers.

Fix: pre-write.mjs must locate the edit's position in the CURRENT file text
and honor enclosing start/end markers before flagging, same as it does for
whole-file scans. Repro: any Edit changing a number inside
groovegrid/src/ui/tracks/effect-panels/ContinuumPanelSpec.h placements.

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
### comment #1 [2026-07-23 18:57] @chris
Maintainer challenged the 'displayName may not contain quotes or newlines' rejection (writes.mjs:101). Verdict: the quote ban is an unescaped-writer shortcut, not a real constraint — the line splice writes display_name: " name\ without escaping. Fix: escape backslash + double-quote on write (YAML double-quoted style), drop quotes from the rejection; KEEP the newline/CR ban (structurally required for the line-oriented splice) and the 48-char cap. Routed to the in-flight KIT-T147 writer since it edits writes.mjs anyway. --author claude

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
- [2026-07-23 18:57] (comment) @chris: Maintainer challenged the 'displayName may not contain quotes or newlines' rejection (writes.mjs:101). Verdict: the quot (full comment #1 in ## Notes)
