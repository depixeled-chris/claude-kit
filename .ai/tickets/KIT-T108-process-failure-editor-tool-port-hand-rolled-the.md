---
id: KIT-T108
title: PROCESS FAILURE (editor tool port): hand-rolled the car-tuner parameter panel out of raw Panel/PanelSection/Slider + custom grid CSS (horizontal scrollbar + no padding), FIGHTING the editor's reusable UI. CORRECTION (was wrong TWICE): the maintainer wants the engine PORTED but the panel built WITH the editor's reusable schema component — `ConfigPanel` (`@features/ui`, "Renders config UI from schema": feed it a ConfigSchema from rapid-game/generation/configSchema + values + onChange(key,value); it owns its own layout/padding/scroll, so it "falls in line"). My first fix was hand-rolling (wrong); my second conclusion — mount the tool's OLD DOM verbatim via createX(host) like AssetEditor — was ALSO wrong (that's for a tool with no schema; a param panel uses ConfigPanel). Root cause: didn't reach for the purpose-built reusable component (ConfigPanel) and instead reinvented layout, twice. FIX (general): for a parameter/config panel, build a ConfigSchema and render `<ConfigPanel>` — never hand-roll Panel+Slider+CSS, and don't assume "mount the old UI verbatim". Ground in the reusable component that already exists for the job BEFORE building. Resolved 2026-06-10 hustle-or-die: CarPhysicsEditor now uses ConfigPanel (tsc + vite green).
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
created: 2026-07-14T17:40:14.680Z
updated: 2026-07-14T17:40:14.680Z
---

## Description
PROCESS FAILURE (editor tool port): hand-rolled the car-tuner parameter panel out of raw Panel/PanelSection/Slider + custom grid CSS (horizontal scrollbar + no padding), FIGHTING the editor's reusable UI. CORRECTION (was wrong TWICE): the maintainer wants the engine PORTED but the panel built WITH the editor's reusable schema component — `ConfigPanel` (`@features/ui`, "Renders config UI from schema": feed it a ConfigSchema from rapid-game/generation/configSchema + values + onChange(key,value); it owns its own layout/padding/scroll, so it "falls in line"). My first fix was hand-rolling (wrong); my second conclusion — mount the tool's OLD DOM verbatim via createX(host) like AssetEditor — was ALSO wrong (that's for a tool with no schema; a param panel uses ConfigPanel). Root cause: didn't reach for the purpose-built reusable component (ConfigPanel) and instead reinvented layout, twice. FIX (general): for a parameter/config panel, build a ConfigSchema and render `<ConfigPanel>` — never hand-roll Panel+Slider+CSS, and don't assume "mount the old UI verbatim". Ground in the reusable component that already exists for the job BEFORE building. Resolved 2026-06-10 hustle-or-die: CarPhysicsEditor now uses ConfigPanel (tsc + vite green).

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
