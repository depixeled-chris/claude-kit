---
id: KIT-D020
title: "Orchestrator-vs-subagent role is STRUCTURAL — instantiated by the SessionStart orient hook, not /prime and not memory"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04 (maintainer)
links: [KIT-T020, KIT-T030]
---

**Decision:** The main thread's role — **orchestrator, not worker** — is instantiated
automatically by the **SessionStart `orient` hook** (`hooks/orient.mjs`), every new session
and after `/clear` & `/compact`, and must NEVER depend on Claude/project memory. The orient
hook is the correct home because it is **main-thread-only** (SessionStart does not fire for
Task-tool subagents — confirmed in `docs/research/agent-token-strategy.md`), so the rule
reaches the orchestrator without bloating every subagent. The rule: delegate all substantive
work (investigation, reads, edits, "is X working?" diagnosis) to subagents with lean
pointer-based briefs; the main thread does only coordination (capture, dispatch, collect
terse summaries, review diff, build, commit, drive the drain); never do IC work in the main
thread; work order is the drain's job (`.ai/config.yml` + roadmap + active `doing`), not the
human's to sequence; and EVERY question to the human goes through `AskUserQuestion`, never
prose, always leading with a recommended option.

**Why:** Maintainer (2026-06-04), emphatically: "you're supposed to know YOUR role vs
subagents and that's where this is failing." The concrete failure that exposed it: the main
thread personally read `hydrate-db.mjs` + KIT tickets and ran query sweeps (worker work),
then asked the maintainer to sequence "HOD vs KIT" (a drain-determined order) and asked
follow-ups in prose without a recommended option. First fix attempts put the rule in the
wrong homes — a project-memory file (rejected: memory is the wrong layer), then `/prime`
(rejected: `/prime` is a MANUAL catch-up command, so the role wouldn't load on a plain new
session or after `/clear`), then the CLAUDE.md workflow-contract template (rejected: CLAUDE.md
is inherited by every subagent — wrong audience + token cost, the exact thing KIT-T030
flags). The maintainer identified the real seam: a lifecycle hook that fires on any new
session / `/clear`. That is SessionStart → `orient`. Role discipline and token discipline are
the same fix (KIT-T020: 84% of spend was at >150k context; a fat orchestrator context is the
top token leak).

**Mechanics:**
- Canonical home: `hooks/orient.mjs` — new `--- IDENTITY & OPERATING MODE (main thread) ---`
  block, just before `--- PROCESS RULES ---` (static heredoc, main-thread-only delivery).
- `commands/prime.md` — trimmed to a 2-3 line pointer at the orient block (DRY; `/prime` no
  longer defines the role, it only catches up).
- Reverted the wrong homes: deleted `hustle-or-die/.claude/memory/orchestrator-role.md`; removed
  the `### Operating rules (always-on)` block from `project-template/CLAUDE.snippet.md`.
- Caveat: `orient.mjs` no-ops in repos without `.ai/` (adoption gate) — the identity loads only
  in adopted projects, which is correct for this workflow.
