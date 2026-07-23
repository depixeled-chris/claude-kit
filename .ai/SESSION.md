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

- KIT-T134 DONE + VERIFIED (eb23354/75b1c73): registry-dataRoot default in
  init-project, scripts/centralize.mjs shared primitives, reconcile-central.mjs
  (dry-run default, guards), orient tripwire. Back-fill EXECUTED + pushed: groovegrid
  (data 88bece8/repo 7961df04), jollys-vinyl (cd0e525/c6a18a8), marblerace2
  (bb32bf9/85b4759). Central store now 7 projects; re-run idempotent (GG/JV/MGP SKIP
  junctioned). Tests: reconcile-central 19, init-project 24, suite EXIT=0.
- KIT-T143 filed (bug, medium): CRX split-brain reconciliation (the one refusal —
  central frozen 9 tickets Jun 15 vs live in-repo 20; needs merge mode, never clobber).
- Inbox cap: centralDataRoot 8.3 short-name path compare (test-env only).

- KIT-T131 DONE + LIVE-VERIFIED (eb3d727): server/ (own package.json, express+cors
  there only), 127.0.0.1:4319, {data,meta} camelCase, reads via exported q.mjs dbOpen
  (staleness→rehydrate), writes via t.mjs/comments.mjs → markdown → regen → hydrate.
  Typed guard 4xx (403 human_only / 422 evidence / 409 not_writable). 12/12 API tests,
  suite EXIT=0. I curl-verified live: /health cacheFresh, /api/projects (8 projects,
  real counts), /api/waiting board. Start: `node server/index.mjs`.

## In flight (roster: .ai/agents.jsonl)
- opus implementer on KIT-T132 (ui/ React 19 + Vite): WAITING-ON-YOU landing,
  /p/:key kanban, /p/:key/t/:id detail (activity merge, comment form, status
  controls w/ guard-4xx surfacing). Harvests Modal/fetch-wrapper/kanban/relative-time
  from D:\dev\workflow\client; types hand-written from real DTOs. Build gate:
  ui/ npm run build (tsc) must pass.

## Parallel session (NOT this session's work — leave uncommitted files alone)
- KIT-D045 + KIT-T135 (UAT role split) — relevant to KIT-T132 accept/close controls.
- It ran the big triage (e104f21: 40 caps → tickets T136+) and captured a triage.mjs
  frontmatter-corruption bug (9677a88). Inbox largely drained by it.

## Next 3 steps
1. Collect KIT-T131 result — verify tests + curl round-trip, receipt.
2. Dispatch KIT-T132 (UI) against the live API shapes.
3. KIT-T143 (CRX merge mode) after the epic slices; watch KIT-D045/T135 landing.

## Carry-over (pre-2026-07-23, still open)
- Inbox: 5 un-triaged items ≥2d (oldest 8d) — run /triage.
- 9 pending gaps in maintenance-gaps.log.
- KIT-T099 OPEN AC: re-run bootstrap.sh on Chris's machines (contract rule + plugin
  refresh so the land-alert hook reloads).
