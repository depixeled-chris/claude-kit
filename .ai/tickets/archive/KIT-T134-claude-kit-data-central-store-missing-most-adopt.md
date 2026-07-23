---
id: KIT-T134
title: claude-kit-data central store missing most adopted projects — sync updates existing dirs but never adds new ones
type: bug
status: done
priority: high
milestone:
labels: []
links: [KIT-T131]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:16:58Z
updated: 2026-07-23T16:04:31Z
fixed_commit: eb23354
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
- [x] Root cause identified and recorded: which component seeds/updates claude-kit-data, and why newly adopted projects never land there
- [x] Every adopted project on this machine exists under claude-kit-data/projects and is pushed
- [x] The adoption/sync path creates the central mirror automatically for a new project (test-covered)
- [x] A reconcile check surfaces "adopted locally but missing centrally" (orient/prime/survey warning) so this class of gap can't rot silently again

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

Implementation (2026-07-23, claude):
- (a) init-project.mjs `resolveDataRoot()` = `CLAUDE_DATA || readRegistry().dataRoot || ''`
  — adoption now centralizes whenever a dataRoot is registered. Script body guarded behind
  `isMain` so importing the module (deriveKey/seedProjectKey in tests/survey) never adopts.
- (b) scripts/reconcile-central.mjs (new, dry-run-default) + scripts/centralize.mjs (shared
  primitives extracted from init-project: copyDir, linkAiJunction, writeProjectPointer,
  updateGitignore, CENTRAL_GITIGNORE — DRY). Guards are hard: missing config, placeholder
  key, split-brain (refuse-and-report with divergence summary), junction failure. Migration
  order is git-recoverable: copy → commit-central → junction → commit-repo; both commits cite
  KIT-T134. `git rm --cached -f .ai` stages the removal past uncommitted-edit safety checks.
- (c) orient.mjs SessionStart tripwire: in-repo .ai + registered dataRoot → banner (kit-self
  exempt via package.json name).
- Executed the real back-fill (dry-run first): groovegrid (GG, data 88bece8 / repo 7961df04),
  jollys-vinyl (JV, data cd0e525 / repo c6a18a8), marblerace2 (MGP, data bb32bf9 / repo
  85b4759). JV key verified = "JV" (NOT placeholder — Notes above were stale). CRX correctly
  REFUSED as split-brain (central 9 vs in-repo 20 tickets; never clobbered). All four repos
  pushed. groovegrid had an active parallel session that committed its own source work
  (bf86b25a) before migration; my repo commit touched ZERO source files (verified).
- Found during work (captured separately as new tickets by triage): centralDataRoot's path
  compare mismatches under 8.3 short-name tmpdirs (Node realpathSync doesn't expand them, git
  does) — test-env only, real D:/dev paths unaffected; test uses realpathSync.native.
### comment #1 [2026-07-23 16:04] @claude
Tests: scripts/reconcile-central.test.mjs 19 passed (split-brain refusal + clean migration against temp fixture; orient banner fires + kit-self/no-dataRoot negatives); init-project.test.mjs 24 passed (resolveDataRoot resolution order); full npm suite green (exit 0). Verify: node scripts/reconcile-central.test.mjs && node scripts/init-project.test.mjs && npm test.

## History
- [2026-07-23 15:16] (created) bug — claude-kit-data central store missing most adopted projects — sync updates existing dirs but never adds new ones
- [2026-07-23 15:37] (status) todo → doing
- [2026-07-23 15:59] (comment) ticked: Root cause identified and recorded: which component seeds/updates claude-kit-data, and why newly adopted projects never land there
- [2026-07-23 15:59] (comment) ticked: The adoption/sync path creates the central mirror automatically for a new project (test-covered)
- [2026-07-23 15:59] (comment) ticked: A reconcile check surfaces "adopted locally but missing centrally" (orient/prime/survey warning) so this class of gap can't rot silently again
- [2026-07-23 16:04] (comment) ticked: Every adopted project on this machine exists under claude-kit-data/projects and is pushed
- [2026-07-23 16:04] (comment) @claude: Tests: scripts/reconcile-central.test.mjs 19 passed (split-brain refusal + clean migration against temp fixture; orient  (full comment #1 in ## Notes)
- [2026-07-23 16:04] (status) doing → done
