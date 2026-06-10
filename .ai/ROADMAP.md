# ROADMAP

Sequenced milestones — the "where are we going" view. Tickets are scheduled
onto a milestone by setting their `milestone:` frontmatter. The drain works the
**current** milestone in order before pulling loose backlog (see
`config.drain.follow_roadmap`).

## Current milestone

## M1-gate-integrity — the gates stop lying and stop leaking
Rationale: every other milestone trusts the enforcement layer; fix the layer first.
- [ ] KIT-T052 commit-gate fires on PowerShell + judges the commit's pathspec (critical)
- [ ] KIT-T053 sync-data truthful receipts — verify push, handle divergence (critical)
- [ ] KIT-T054 orient divergence detection + unpushed-work nag
- [ ] KIT-T055 pre-write fail-open guard + lib readdirSync import bug
- [ ] KIT-T056 query-gate hardening (pipe-segment escape, store-path false positive)
- [ ] KIT-T058 tests for the zero-test hooks
- [ ] KIT-T057 retire legacy .claudekit-ignore
- [ ] KIT-T059 lib consolidation (one glob, one ext-parser, one root-walk, one id-regex)

## Upcoming

## M2-close-the-loop — the system gets as loud about unfinished work as uncaptured work
Rationale: 0 tickets ever done, 23 in review, inbox rots silently — closure is the
weakest stage of the lifecycle and it poisons regression tracking downstream.
- [ ] KIT-T060 /done command (flip tail: history, archive, index regen)
- [ ] KIT-T061 review-entry evidence gate ([no-test: reason] escape)
- [ ] KIT-T062 closure nags (inbox age, review queue, stale SESSION)
- [ ] KIT-T063 INDEX/SUPERSEDED/REGRESSIONS auto-regen via hook
- [ ] KIT-T064 question drain folded into /drain

## M3-provenance — backward provenance becomes mechanical, not judgment
Rationale: forward provenance (request→ticket→commit) is gate-enforced; backward
(bug→cause) has zero machinery. Depends on M2 (fixed_commit only exists once things
reach done).
- [ ] KIT-T067 cap routing fix + re-home the ~16 misfiled HOD captures (critical — provenance roots)
- [ ] KIT-T065 triage-time provenance inference (files → q governing items → git log candidates)
- [ ] KIT-T066 regression link integrity in the id-integrity slot
- [ ] KIT-T048 provenance enforcement remainder (summary frontmatter, ticket-start gate, antecedent lint — phase 1 `q trail` shipped 4448742)

## M4-one-truth — one written contract, no split-brain
Rationale: five documented self-contradictions (Notes/History, triage semantics, ID
templates, command overlap, config drift) each breed future misbehavior.
- [ ] KIT-T068 contract reconciliation (incl. delete /status — native collision; keep /standup)
- [ ] KIT-T069 config truth (template↔repo, hooks.json↔settings, remove groomer knob, slim native_task_sync)
- [ ] KIT-T070 doc rot pass + doc-audit wired into release-checklist

<!-- Unscheduled backlog from the same review (deliberately NOT a milestone — schedule
     after M1–M4 land, per 2026-06-09 decision):
     KIT-T071 orient token budget · KIT-T072 hook output quieting ·
     KIT-T073 CLAUDE.md progressive disclosure · KIT-T074 maintenance-gaps drain path
     Plus standing ops (no tickets): push main at every boundary; /triage the 25-item
     inbox (re-home HOD strays per KIT-T067). -->

## Shipped
<!-- move completed milestones here -->
