---
# id: NEVER hand-pick — allocate with `node <kit>/scripts/next-id.mjs tickets` (KIT-T009).
id: KEY-T000
title: <short imperative title>
type: bug              # any key from .ai/config.yml → classifications
status: todo           # todo | doing | review | done | superseded  (see config.statuses)
priority: medium       # critical | high | medium | low
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
links: []              # related tickets / URLs
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: <YYYY-MM-DDThh:mm:ssZ>
updated: <YYYY-MM-DDThh:mm:ssZ>
# --- bugs / regressions only (drive REGRESSIONS.md) ---
regressed_from:        # T-### this is a recurrence of (set on a regression ticket)
causing_commit:        # sha that introduced the bug
fixed_commit:          # sha that fixed it (set when status -> review/done)
provenance:            # how regressed_from/causing_commit got here: `given` (user-named) | `inferred` (triage guess — KIT-T065). Absent = unknown.
---

## Description
<what and why>

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced (KIT-D037). -->

## History
<!-- APPEND-ONLY, oldest first. One line per event; NEVER edit or delete a prior line —
     this is the task's audit trail. Format:  - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as) -->
- [<YYYY-MM-DD HH:MM>] (created)
