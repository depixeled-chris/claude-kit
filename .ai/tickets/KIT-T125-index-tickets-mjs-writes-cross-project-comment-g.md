---
id: KIT-T125
title: index-tickets.mjs writes cross-project + comment-garbage SUPERSEDED chains

Running `node D:\dev\claude-kit\scripts\index-tickets.mjs D:\dev\groovegrid`
(repo with 2 GG tickets, zero supersessions) produced .ai/SUPERSEDED.md
containing KIT-* chains from another project AND a chain parsed from the
ticket template's comment line:
  "# ticket id this one RETIRES (set on the NEWER ticket)" → KIT-T044
Two defects: (1) supersession chains leak across project scopes instead of
being filtered to the target repo's key; (2) the parser reads frontmatter
comments / _TEMPLATE.md as real values. Fix at the kit source per the hook
contract, not per-project. Could not locate the kit's own inbox from the
groovegrid session (D:\dev\claude-kit has no .ai/; central store path not
discoverable via q.mjs usage) — hence captured here.

[re-capped 2026-07-14 from groovegrid inbox at triage — cap said KIT-scope, triage cannot rescope]
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
created: 2026-07-14T17:46:37.007Z
updated: 2026-07-14T17:46:37.007Z
---

## Description
index-tickets.mjs writes cross-project + comment-garbage SUPERSEDED chains

Running `node D:\dev\claude-kit\scripts\index-tickets.mjs D:\dev\groovegrid`
(repo with 2 GG tickets, zero supersessions) produced .ai/SUPERSEDED.md
containing KIT-* chains from another project AND a chain parsed from the
ticket template's comment line:
  "# ticket id this one RETIRES (set on the NEWER ticket)" → KIT-T044
Two defects: (1) supersession chains leak across project scopes instead of
being filtered to the target repo's key; (2) the parser reads frontmatter
comments / _TEMPLATE.md as real values. Fix at the kit source per the hook
contract, not per-project. Could not locate the kit's own inbox from the
groovegrid session (D:\dev\claude-kit has no .ai/; central store path not
discoverable via q.mjs usage) — hence captured here.

[re-capped 2026-07-14 from groovegrid inbox at triage — cap said KIT-scope, triage cannot rescope]

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
