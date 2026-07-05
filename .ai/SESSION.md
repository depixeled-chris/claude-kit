# SESSION HANDOFF — claude-kit

Updated: 2026-06-12 00:50  |  Branch: main  |  Active: M2 current — T075 first

## Drive-by (2026-06-21, from marblerace2 session) — KIT-T099 test-receipt gate
- KIT-T099 (review): land-alert Stop gate now requires a TEST receipt (not just a landing
  receipt) — a turn that commits work must say what to RUN, or [no-test: reason]. Plus a
  WORKING-RULES contract rule (lead with what CHANGED; end with what's TESTABLE). 14 hook
  tests pass. Files: hooks/land-alert.mjs (+.test), user-config/CLAUDE.global.md, ticket
  .ai/tickets/KIT-T099-test-receipt-gate.md. OPEN AC: re-run bootstrap.sh on Chris's
  machines to compose the contract rule + refresh the plugin so the hook reloads.
- PROCESS NOTE: first mis-numbered this KIT-T088 (collided with the ARCHIVED
  request-gate-flags-compaction ticket) — renumbered to T099 via `q next-id`. Lesson:
  check tickets/ AND archive/ (or use `q next-id`) before assigning an id.

## Drive-by (2026-06-12, from marblerace2 session)
- KIT-T088 logged (bug, medium): request-gate.mjs flags the harness-injected
  compaction summary ("This session is being continued from a previous
  conversation…") as an un-captured request; fired twice in one resumed
  session. Fix: skip synthetic continuation text (structural marker over
  preamble match), keep flagging real requests, add fixture test.
  Committed b4c5d93, PUSHED to origin/main. Index regenerated (31 active).

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
