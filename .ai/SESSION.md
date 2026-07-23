# SESSION HANDOFF — claude-kit

Updated: 2026-07-23  |  Branch: main  |  Active: KIT-T129 (epic) — web UI + REST API

## Current state (2026-07-23)
- KIT-T129 captured + pushed (2291ea5): epic — web UI + REST API over the .ai store so
  the maintainer can review/comment on review-parked tickets from a browser; comments
  land as durable ticket artifacts a tabula-rasa agent picks up via drain. Harvest
  source: D:\dev\workflow (client = React 19 + Vite + react-router; server = Express +
  better-sqlite3; see README.api.md there).
- Researcher subagent IN FLIGHT: sweeping D:\dev\workflow client/server for liftable
  screens/routes/data-layer + a harvest verdict (roster: .ai/agents.jsonl).
- Kit-side grounding DONE: API can sit on existing surfaces — reads = q.mjs
  (dbOpen/verifyCache/cannedQueries) + per-project SQLite cache; writes = t.mjs
  (scaffoldNew/setStatus/tick/link/appendUnderSection/evidenceFloor/refresh); cross-
  project discovery = survey.mjs readRegistry() + claude-kit-data central notebooks
  (scan at scripts/survey.mjs:49-78). survey.mjs already emits the "WAITING ON YOU"
  review board the UI needs.

## Next 3 steps
1. Collect researcher output; fold harvest verdict into KIT-T129 Notes.
2. AskUserQuestion: scope (cross-project hub vs per-repo), lift-vs-rebuild client,
   phase-1 comment pickup (durable comments + drain vs headless agent dispatch),
   exposure (localhost vs deployable/auth).
3. Cut child tickets per accepted design; regen views; commit.

## Carry-over (pre-2026-07-23, still open)
- Inbox: 5 un-triaged items ≥2d (oldest 8d) — run /triage.
- 9 pending gaps in maintenance-gaps.log.
- KIT-T099 OPEN AC: re-run bootstrap.sh on Chris's machines (contract rule + plugin
  refresh so the land-alert hook reloads).
