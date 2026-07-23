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

## In flight (roster: .ai/agents.jsonl)
- opus implementer on KIT-T130 (t comment / q mentions / t ack / orient+drain
  surfacing + tests; commits to main citing KIT-T130; closes done per uat:none).
- opus researcher on KIT-T134 root cause (read-only; report with fix shape).

## Next 3 steps
1. Collect KIT-T130 agent result — verify tests, review diff, receipt to Chris.
2. Collect KIT-T134 root-cause report — fold into ticket, then fix (seed + reconcile
   warning) after T130 lands (avoid shared-tree commit races).
3. Dispatch KIT-T131 (API) once T130's comment verb + shapes exist.

## Carry-over (pre-2026-07-23, still open)
- Inbox: 5 un-triaged items ≥2d (oldest 8d) — run /triage.
- 9 pending gaps in maintenance-gaps.log.
- KIT-T099 OPEN AC: re-run bootstrap.sh on Chris's machines (contract rule + plugin
  refresh so the land-alert hook reloads).
