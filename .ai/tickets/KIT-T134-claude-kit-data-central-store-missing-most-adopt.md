---
id: KIT-T134
title: claude-kit-data central store missing most adopted projects — sync updates existing dirs but never adds new ones
type: bug
status: todo
priority: high
milestone:
labels: []
links: [KIT-T131]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:16:58Z
updated: 2026-07-23T15:16:58Z
---

## Description
Reported by Chris 2026-07-23: the remote claude-kit-data repo is missing most projects
(no groovegrid, no infocus-official, "probably lots of others"). Diagnostic (same day):
LOCAL claude-kit-data == remote (in sync on main, one modified
projects/hustle-or-die/agents.jsonl) and holds only FOUR projects: client-rx-clinical,
gridiron-blitz, hustle-or-die, woodshed. Meanwhile the machine registry/orient knows
~10 scopes (CRX DUP GG HOD JV KIT MGP ORI RCN WOOD) plus infocus-official. So this is
NOT an unpushed-commit problem — the missing projects were never seeded into the
central store at all. All recent commits are bare "sync: workflow data" updates to the
existing four dirs.

Hypothesis: the sync writer updates existing project dirs but nothing in the adoption
path (init-project) creates the central mirror, so every project adopted after the
initial seeding is invisible cross-machine. Load-bearing for KIT-T131: the hub's
discovery (registry + central notebooks) is blind to these projects on any machine but
the one they live on.

## Acceptance Criteria
- [ ] Root cause identified and recorded: which component seeds/updates claude-kit-data, and why newly adopted projects never land there
- [ ] Every adopted project on this machine exists under claude-kit-data/projects and is pushed
- [ ] The adoption/sync path creates the central mirror automatically for a new project (test-covered)
- [ ] A reconcile check surfaces "adopted locally but missing centrally" (orient/prime/survey warning) so this class of gap can't rot silently again

## Plan
1. Locate the "sync: workflow data" writer (grep the kit scripts/hooks/scheduled jobs).
2. Trace init-project/adoption: where SHOULD central seeding happen.
3. Seed the missing projects, push, add the reconcile warning + tests.

## History
- [2026-07-23 15:16] (created) bug — claude-kit-data central store missing most adopted projects — sync updates existing dirs but never adds new ones
