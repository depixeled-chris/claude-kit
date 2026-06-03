# SESSION HANDOFF — claude-kit

Updated: 2026-06-03  |  Branch: main  |  Active: T-001 (scope-aware /prime)

## Goal (this session)
Capture the agreed design for a scope-aware `/prime` as claude-kit's first real ticket
(T-001), and fill in this previously-empty handoff note.

## Acceptance criteria (DONE = all true) — see .ai/tickets/T-001-scope-aware-prime.md
- [ ] `/prime` (no arg) → cross-project "what needs me?" briefing, waiting-on-you first
- [ ] no-arg briefing is LAZY: deep only on the active (session-folder) project, others one-line
- [ ] `/prime <project…>` → deep resume of named project(s) from anywhere
- [ ] output reads like a human briefing, not a raw note dump
- [ ] git temperature included per project when its repo is known on this machine
- [ ] machine-local project→repo map, self-healed by orient; NOT committed to synced data
- [ ] `npm test` covers survey + registry

## Current state
Design fully settled in conversation (see T-001 Notes for the maintainer's reframings).
Ticket T-001 written; status `todo`. NOTHING built yet — awaiting the maintainer's go.

## Next 3 steps
1. On "go": lib.mjs registry helpers → orient self-heal → scripts/survey.mjs → prime.md rewrite.
2. Add test coverage (survey + registry); bump plugin version.
3. Commit citing T-001; push.

## Exact commands / facts (verbatim — do not paraphrase)
- claude-kit is LOCAL-mode (.ai/ lives in-repo; no .claude-project). IDs: T-### (pad 3).
- This is claude-kit's FIRST ticket — prior work (plugin, hooks, D-008/9/10) was tracked via
  decisions + the hustle-or-die pilot notebook. T-001 starts claude-kit tracking itself.
- Builds on D-010 (orient already surfaces per-repo working-tree temperature + watch_repos).

## Re-prime line (paste into a fresh session)
Read .ai/SESSION.md, the active ticket .ai/tickets/T-001-*.md. Confirm scope, then
continue from "Next 3 steps". Nothing built yet — get the go before editing files.
