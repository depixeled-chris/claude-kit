---
id: KIT-T102
title: (bug, KIT/agents) WORKTREE-ISOLATED BACKGROUND AGENT LEFT THE PRIMARY CHECKOUT ON A STALE BRANCH. 2026-06-06: after a background isolation:worktree agent (legacy-TS separation) ran + completed, the MAIN repo checkout (D:\dev\hustle-or-die) had silently switched from the working branch (hod-t107-physics-p0 @ 465bea4) to 'main' @ 56b3809 (an OLD HOD-T074 base) — the working tree reverted to pre-terrain/physics content (main.ts/Scene.ts/lib.rs all stale). No work lost (all committed on hod-t107-physics-p0; restored via git checkout), but this is a HAZARD: if there had been uncommitted work in the primary tree it could have been lost/confused, and an agent resuming blind would build on the stale tree. Also: the worktree was cut from a STALE base (56b3809) not the live tip, so the agent's output is based on old paths. FIXES: (1) worktree isolation must NOT move the primary checkout's HEAD; (2) a worktree must be cut from the LIVE working branch tip, not a stale ref; (3) orient/a guard should flag 'your checkout moved branches unexpectedly'. Project: KIT.
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
links: [KIT-T082]
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.652Z
updated: 2026-07-14T17:40:14.652Z
---

## Description
(bug, KIT/agents) WORKTREE-ISOLATED BACKGROUND AGENT LEFT THE PRIMARY CHECKOUT ON A STALE BRANCH. 2026-06-06: after a background isolation:worktree agent (legacy-TS separation) ran + completed, the MAIN repo checkout (D:\dev\hustle-or-die) had silently switched from the working branch (hod-t107-physics-p0 @ 465bea4) to 'main' @ 56b3809 (an OLD HOD-T074 base) — the working tree reverted to pre-terrain/physics content (main.ts/Scene.ts/lib.rs all stale). No work lost (all committed on hod-t107-physics-p0; restored via git checkout), but this is a HAZARD: if there had been uncommitted work in the primary tree it could have been lost/confused, and an agent resuming blind would build on the stale tree. Also: the worktree was cut from a STALE base (56b3809) not the live tip, so the agent's output is based on old paths. FIXES: (1) worktree isolation must NOT move the primary checkout's HEAD; (2) a worktree must be cut from the LIVE working branch tip, not a stale ref; (3) orient/a guard should flag 'your checkout moved branches unexpectedly'. Project: KIT.

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
