---
id: KIT-T119
title: Orientation lacks runtime TOPOLOGY -- session-start rails surface identity/commits/queue but NOTHING about what serves what (ports, dev servers, API processes). Live cost (HOD 2026-07-05): agent burned a debugging arc on 'is 3001 legacy?' when the answer (editor.vite.config.ts at HOD root per HOD-T160; 3001 = current recipe API; 5174 = React editor) was derivable from the ticket store + git -- and the maintainer had to steer twice. Agent-side failing: didn't run provenance-first (KIT-T079) before runtime theories. Kit-side gap: orientation should emit a topology line when the project declares one (e.g. a TOPOLOGY.md or memory entry) so process-level debugging starts grounded, not derived per session.
type: feature
status: todo
priority: medium
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
created: 2026-07-14T17:40:14.715Z
updated: 2026-07-14T17:40:14.715Z
---

## Description
Orientation lacks runtime TOPOLOGY -- session-start rails surface identity/commits/queue but NOTHING about what serves what (ports, dev servers, API processes). Live cost (HOD 2026-07-05): agent burned a debugging arc on 'is 3001 legacy?' when the answer (editor.vite.config.ts at HOD root per HOD-T160; 3001 = current recipe API; 5174 = React editor) was derivable from the ticket store + git -- and the maintainer had to steer twice. Agent-side failing: didn't run provenance-first (KIT-T079) before runtime theories. Kit-side gap: orientation should emit a topology line when the project declares one (e.g. a TOPOLOGY.md or memory entry) so process-level debugging starts grounded, not derived per session.

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
