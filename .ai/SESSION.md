# SESSION HANDOFF — claude-kit

Updated: 2026-07-23  |  Branch: main  |  Active: M4-web-ui phase 1 SHIPPED

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

- KIT-T132 DONE + VERIFIED (f093e7c): ui/ React 19 + Vite + router, 37 atomic files,
  3 screens (WAITING-ON-YOU landing, /p/:key kanban, /p/:key/t/:id detail w/ activity
  merge + comment form + guard-4xx surfacing). Harvested Modal/fetch-wrapper/kanban/
  relative-time from workflow client; types hand-written camelCase. I re-ran the build
  gate: tsc+vite ✓ 987ms. Comment round-trip proven (POST → refetch, mentions derived).
- KIT-T129 EPIC CLOSED done (all 5 AC ticked, evidence comment KIT-T129#1). Phase 2 =
  KIT-T133 (headless dispatch, backlog).
- RUN THE STACK — ONE COMMAND (8cc658e): `npm start` = ui:build + serve; the API
  serves ui/dist at http://127.0.0.1:4319/ (SPA fallback via server/lib/static-ui.mjs;
  /api + /health keep typed JSON 404). Chris rejected the two-script DX. Currently
  RUNNING in session background + HTTP-verified (GET / 200 text/html, /api/waiting
  200). `npm run ui` (Vite :5173 + proxy) remains for UI development only. Server
  tests 14/14 (2 new static-UI cases).
- Push sweep verified (6b07a47): kit + data + GG/JV/MGP all in sync with remotes;
  6b07a47 completed the T129 archive move (original's deletion had been left
  unstaged by the close commit). Only parallel-session files remain uncommitted
  (KIT-D045, KIT-T135, agents.jsonl) — theirs to land.

- UI feedback round (Chris, live, 2026-07-23 evening): swimlane-heading tints SHIPPED
  (bfaceb0, rebuilt + served on :4319). KIT-T144 filed (e19942c) + agent DISPATCHED:
  /all stacked collapsible per-project kanbans. Two mid-flight scope-adds recorded as
  ticket comments KIT-T144#1/#2 and SendMessage'd to the running agent: (1) boards use
  FULL viewport width — no brochure max-width on /p/:key + /all (detail may keep one);
  (2) expanded section headings show "project-name (KEY)", never shorthand alone.

## Parallel session (NOT this session's work — leave uncommitted files alone)
- KIT-D045 + KIT-T135 (UAT role split) — relevant to UI accept/close semantics.
- It ran the big triage (e104f21: 40 caps → T136+) and captured a triage.mjs
  frontmatter-corruption bug (9677a88).

- Live-testing capture wave (86b8547 + 066ced2), all high, M4-web-ui, QUEUED behind
  the in-flight T144 agent (single writer in ui/):
  KIT-T145 identity/alias — no personal names in code (KIT_USER → registry user →
  'user'; /api/me; regression test). Sweep of offenders is in the ticket.
  KIT-T146 mentions page + nav unread badge (depends T145).
  KIT-T147 send-back requires comment — inline box + API 422 on comment-less backward
  transition, auto-@mention the agent.
  KIT-T148 sha chips misroute as ticket links → classify chips, GitHub commit URL.

- KIT-T144 DONE + VERIFIED (2f6e6ef): /all stacked collapsible kanbans (KanbanBoard +
  ProjectSection extracted), full-width boards (.main--wide on /all + /p/:key only),
  "name (KEY)" headings. Build ✓ 919ms, suite EXIT=0, live /all 200 (I re-verified).
- KIT-T149 captured (756e9cc): nav redesign — pinnable tabs + secondary dropdowns
  (project selector, settings w/ /api/me identity).

- FIVE-TICKET WAVE LANDED + VERIFIED (all done/archived/pushed): T145 identity
  (42e2d73, identity.test 6/6, no-personal-names regression test), T149 nav tabs +
  dropdowns (004f6b5), T146 mentions inbox/badge/page (db115d8, server 20/20 round-
  trips), T147 send-back-requires-comment + T137 quote-escape fix (5e81c9c, 22/22),
  T148 sha chips (8304699 + 438414d, chips test green). I restarted the API on 4319
  (old process predated T146) and live-verified: /api/me alias, /api/mentions
  (2 unread), /mentions 200. Suite spot-checks re-run by me: identity 6/6, server
  22/22, chips green.
- Parallel session landed KIT-T151 (985d243): dispatch-ladder hook + agent opus pins;
  and a CRLF .gitattributes addendum cap.

- KIT-T150 filed (5643897): agent bug/feature capture protocol — answered Chris's
  question (NO such protocol exists today; findings evaporate unless the orchestrator
  caps them — 3 same-day examples in the ticket). Queued behind the wave with T143.
- Wave progress visible in tree: T145 landed /api/me (live: alias "chris" from
  registry user field); T146 doing.
- KIT-T152 captured (64a735d), narrowed to the DELTA over KIT-T137 (parallel session
  shipped UI-editable display_name in config.yml): extrapolated default title,
  .ai/PROJECT.md details file (cross-device via store sync), DTO description, seeding.
- KIT-T137 quote-ban verdict recorded (T137#1) + routed to the wave agent's T147
  writes.mjs pass: escape quotes on write, keep newline/length rules, test.
- Process cap (inbox): filed T152 without pre-filing q fts dedup vs concurrent T137 —
  KIT-T025 (review) is the structural fix.
- Global CLAUDE.md updated by parallel session: KIT-D045 (UAT receipts — cite test
  RESULTS, never assign test commands) + KIT-T151 (kit agents pin model: opus;
  unpinned delegations from fable main need explicit model). Honor both.

## Next 3 steps
1. Collect the wave agent (T145→T149→T146→T147→T148) — verify per-ticket evidence +
  live /mentions, receipt.
2. Then drain: KIT-T150 (capture protocol) + KIT-T143 (CRX merge mode).
3. KIT-T133 on Chris's flip; watch KIT-D045/T135 (parallel session) landing.

## Carry-over (pre-2026-07-23, still open)
- Inbox: 5 un-triaged items ≥2d (oldest 8d) — run /triage.
- 9 pending gaps in maintenance-gaps.log.
- KIT-T099 OPEN AC: re-run bootstrap.sh on Chris's machines (contract rule + plugin
  refresh so the land-alert hook reloads).
