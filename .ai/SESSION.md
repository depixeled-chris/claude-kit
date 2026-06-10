# SESSION HANDOFF — claude-kit

Updated: 2026-06-10  |  Branch: main  |  Active: M1 SHIPPED+ARCHIVED (KIT-D034 UAT sweep); M2 current — T075 first

## Goal (this session)
Full-plugin process review (three researcher sweeps: hooks pipeline, command/skill
surface, live .ai store health) + token-caching review + lifecycle/provenance review →
plan-of-record: 23 tickets (KIT-T052–T074), 4 milestones on ROADMAP.md, decisions
KIT-D029/030/031.

## Current state
- main was DIVERGED across machines (5cb1cf3 local vs 8beb1fa remote, both editing
  hooks/pre-write.mjs). Rebased + resolved: stylesheet checks joined the T051 exclusion
  system under the `magic-numbers` id; finish() takes {id,msg} + excludeFooter. All 49
  hook tests green. Rebased commit: ddcd4f1. **PUSH PENDING (push to origin/main was
  permission-denied this session — Chris pushes).**
- Plan committed: ROADMAP has M1-gate-integrity (T052-T059) → M2-close-the-loop
  (T060-T064) → M3-provenance (T065-T067) → M4-one-truth (T068-T070); T071-T074
  deliberately unscheduled (KIT-D031).
- Inbox still holds 25 untriaged caps from 2026-06-06 (14 uncommitted); ~16 are HOD
  items misfiled by the cap cwd-walk bug (now KIT-T067).

## Next 3 steps
1. Chris: `git push` (main far ahead of origin; push denied to agent this session).
2. Drain M2: KIT-T075 (mutation CLI + t new + write-time lint; uat-aware per KIT-D034)
   first, then T061 (evidence at the CLOSING transition) / T062 / T063 / T064.
3. `/triage` the 25-item inbox (re-home HOD strays per KIT-T067) + sweep HOD standing
   decisions for single-`*` paths globs (T059 dialect change).
KEY STATE: uat.default none for claude-kit (KIT-D033/D034); human_only []; 32 review
tickets swept done+archived 2026-06-10; INDEX/SUPERSEDED/REGRESSIONS regenerated.

## Exact commands / facts (verbatim — do not paraphrase)
- Conflict resolution: PREPROC stylesheet block in hooks/pre-write.mjs exits early via
  `excludedFile('magic-numbers')`; entries are `{id, msg}`; reporter is `finish()`.
- Test runs: `node scripts/test-hooks.mjs` (31 pass) + `node hooks/exclusions.test.mjs`
  (18 pass).
- Next ids at time of writing: tickets KIT-T075, decisions KIT-D032.
- Native Claude Code `/status` built-in collides with the kit's /status → KIT-D029
  (keep /standup, delete /status in KIT-T068).

## Re-prime line (paste into a fresh session)
Read .ai/SESSION.md and .ai/ROADMAP.md. Plan-of-record is KIT-T052–T074 across M1–M4.
If main is still ahead of origin, ask Chris to push before starting M1. Then /drain M1
(KIT-T052 first). Confirm scope before editing files.
