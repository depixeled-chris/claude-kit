# SESSION HANDOFF — claude-kit

Updated: 2026-07-23  |  Branch: main  |  Active: KIT-T129 (epic) — web UI + REST API

## Current state (2026-07-23)
- KIT-T129 epic DESIGNED + children cut (cc4fffd pushed). KIT-D044 records the
  architecture: cross-project hub; cache-READ / markdown-WRITE bidirectional (Chris's
  mid-turn directive — API reads SQLite cache, ALL writes through t.mjs code paths to
  markdown truth, cache rehydrates); phase-1 comment loop = durable comment + @mention
  + read-receipt pull (workflow harvest centerpiece); localhost only; headless
  dispatch deferred to phase 2 (KIT-T133). Harvest verdict in KIT-T129 Notes.
- Children: KIT-T130 comment/mention primitive (doing — agent in flight), KIT-T131
  API hub server, KIT-T132 web UI, KIT-T133 dispatch (backlog). Milestone M4-web-ui.
- KIT-T134 filed (high): claude-kit-data central store holds only 4 projects (local ==
  remote, in sync) vs ~10 adopted scopes — missing projects were NEVER SEEDED; sync
  only updates existing dirs. Researcher agent in flight on root cause (read-only).
- Inbox capture: t new ignores classifications.<type>.priority (scaffolded T134 medium
  vs config high).

## Landed 2026-07-23 (verified)
- KIT-T130 DONE (2ae4bc2, pushed): scripts/comments.mjs model + t comment / t ack /
  q mentions + orient/drain surfacing + .ai/read-receipts.json sidecar. Verified live:
  comments 35 passed, t 49 passed; q mentions round-trip incl. ack. Agent identity via
  $KIT_AGENT/$CLAUDE_AGENT (default claude).
- KIT-T134 root cause folded (a4d427e): CLAUDE_DATA-gated seeding; CRX split-brain
  (central frozen 10 tickets vs live 21 — never clobber); back-fill list GG/JV/MGP.

## In flight (roster: .ai/agents.jsonl)
- opus implementer on KIT-T134 fix: (a) init-project registry-dataRoot default,
  (b) reconcile-central.mjs (dry-run default, --execute, split-brain refusal —
  CRX must refuse), (c) orient tripwire; executes back-fill for clean cases only;
  pushes kit + data + touched project repos, all citing KIT-T134.

## Parallel session (NOT this session's work — leave uncommitted files alone)
- Untracked in tree: KIT-D045 (maintainer-does-UAT / claude-owns-automated-tests) +
  KIT-T135 (codify UAT role split). Relevant to KIT-T132's accept/close controls —
  reconcile when that session commits.

## Next 3 steps
1. Collect KIT-T134 fix result — verify dry-run report + migrations, receipt.
2. Dispatch KIT-T131 (API hub) — T130 shapes now exist.
3. Then KIT-T132 (UI); /triage the inbox (7 items now).

## Carry-over (pre-2026-07-23, still open)
- Inbox: 5 un-triaged items ≥2d (oldest 8d) — run /triage.
- 9 pending gaps in maintenance-gaps.log.
- KIT-T099 OPEN AC: re-run bootstrap.sh on Chris's machines (contract rule + plugin
  refresh so the land-alert hook reloads).
