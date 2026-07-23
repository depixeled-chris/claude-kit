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
Per root cause (Notes, 2026-07-23):
1. (a) init-project.mjs:36 — default DATA to `process.env.CLAUDE_DATA || readRegistry().dataRoot || ''` so adoption centralizes whenever a dataRoot is registered (one-line stop-the-bleeding).
2. (b) scripts/reconcile-central.mjs — back-fill GG/JV/MGP (move in-repo .ai → central, junction, gitignore, hooks; reuse seedCentralDataDir + centralDataRoot/readRegistry/recordProject). MUST refuse-and-report on split-brain (CRX: central frozen at 10 tickets Jun 15 vs live in-repo 21 — never clobber the live copy).
3. (c) orient.mjs:141 tripwire — warn when dataRoot===null but registry has one and .ai exists ("in-repo, not centralized — run reconcile-central"); optional survey.mjs flag in /prime.
4. Tests for (a) default resolution, (b) split-brain refusal, (c) warning fire.

## Notes
Root cause (researcher, 2026-07-23) — hypothesis CONFIRMED with refinement:
- Adoption DOES seed centrally, but only when CLAUDE_DATA is set at adoption time
  (init-project.mjs:36 reads the env var only, IGNORING the registry's known dataRoot;
  :158-170 centralized branch vs :171-178 local branch). CLAUDE_DATA is currently
  UNSET on this machine → adoptions go in-repo, permanently.
- The sync writer is hooks/sync-data.mjs (Stop hook; the "sync: workflow data"
  commits, :43-44). It only commits what is already dirty inside the junction target —
  gated by centralDataRoot (hooks/lib.mjs:344-354), which returns null for in-repo
  .ai → sync exits. It can never seed or migrate.
- Why the 4 are present: HOD + WOOD junctioned (adopted while CLAUDE_DATA set);
  gridiron-blitz centralized on ANOTHER machine (no local repo here); CRX is
  SPLIT-BRAIN — was centralized once, live .ai is now a plain in-repo dir; central
  copy frozen Jun 15 (10 tickets) vs in-repo live (21 tickets).
- Definitive gaps to back-fill: groovegrid, jollys-vinyl (config key still
  'placeholder'), marblerace2; plus CRX divergence reconciliation.
- NOT this bug (captured separately): infocus-official was never adopted at all (no
  .ai/, no registry entry); DUP/ORI/RCN are test-fixture scopes leaked into the
  production cache by tests hydrating real workflow.db.
- Registry: ~/.claude/claude-kit-projects.json (dataRoot: D:/dev/claude-kit-data;
  itself incomplete — missing woodshed).

## History
- [2026-07-23 15:16] (created) bug — claude-kit-data central store missing most adopted projects — sync updates existing dirs but never adds new ones
