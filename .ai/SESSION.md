# SESSION HANDOFF — claude-kit

Updated: 2026-06-03  |  Branch: main  |  Active: KIT-T001 (scope-aware /prime)

## Goal (this session)
Capture the agreed design for a scope-aware `/prime` as claude-kit's first real ticket
(KIT-T001), and fill in this previously-empty handoff note.

## Acceptance criteria (DONE = all true) — see .ai/tickets/KIT-T001-scope-aware-prime.md
- [ ] `/prime` (no arg) → cross-project "what needs me?" briefing, waiting-on-you first
- [ ] no-arg briefing is LAZY: deep only on the active (session-folder) project, others one-line
- [ ] `/prime <project…>` → deep resume of named project(s) from anywhere
- [ ] output reads like a human briefing, not a raw note dump
- [ ] git temperature included per project when its repo is known on this machine
- [ ] machine-local project→repo map, self-healed by orient; NOT committed to synced data
- [ ] `npm test` covers survey + registry

## Current state
KIT-T001 BUILT and verified — status `review`. lib.mjs (registry + shared wip/format helpers),
orient.mjs (self-heals registry), scripts/survey.mjs (lazy briefing + named deep-dive),
commands/prime.md (rewritten). `npm test` 21/21. Version 0.1.4. Awaiting maintainer review
(+ `/plugin update` on other machines to ship the new prime).

## Next 3 steps
1. Maintainer: try `/prime` (lazy) and `/prime <name>` (deep); set KIT-T001 `done` if good.
2. On other machines, `/plugin update` to pull 0.1.4 (dev-link is live here already).
3. Then back to hustle-or-die: Rust migration A–D decisions (gated on maintainer).

## Exact commands / facts (verbatim — do not paraphrase)
- claude-kit is LOCAL-mode (.ai/ lives in-repo; no .claude-project). IDs: KIT-<TYPE><NUM> (KIT-T001, KIT-D010; pad 3).
- This is claude-kit's FIRST ticket — prior work (plugin, hooks, KIT-D008/9/10) was tracked via
  decisions + the hustle-or-die pilot notebook. KIT-T001 starts claude-kit tracking itself.
- Builds on KIT-D010 (orient already surfaces per-repo working-tree temperature + watch_repos).

## Re-prime line (paste into a fresh session)
Read .ai/SESSION.md, the active ticket .ai/tickets/KIT-T001-*.md. Confirm scope, then
continue from "Next 3 steps". Nothing built yet — get the go before editing files.
