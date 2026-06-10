---
id: KIT-T006
title: Request-capture ratchet — Stop-time gate so accepted requests get logged structurally, not from memory
type: feature
status: done
priority: high
milestone:
labels: [hooks, capture, enforcement]
links: [KIT-T005]
aka: [request ratchet, capture gate]
files:
  - hooks/request-gate.mjs
  - hooks/request-gate.test.mjs
  - hooks/flush.mjs
  - hooks/hooks.json
  - user-config/settings.recommended.json
  - .ai/config.yml
created: 2026-06-03T16:30:00Z
updated: 2026-06-10T06:00:00Z
---

## Description
Make request capture **structural** instead of memory-dependent. A request (an actionable,
ticketable ask) has no choke point the way `git commit` does, so an accepted one can be carried
in the model's head and then buried by a context pivot — never logged. (Concrete failure this
session: a "build a decision-questionnaire command" ask went un-logged for an entire session.)
The fix manufactures a choke point at the **Stop** event — the end of every assistant turn.

Three layers:
- **L1 frictionless capture** — `cap` writes one-line items to `.ai/inbox/`; triage drains them.
- **L2 Stop gate** (`hooks/request-gate.mjs`) — if the last user message looks like a request
  (tunable signal regexes) and nothing was captured this turn, **block the stop once**.
- **L3 boundary net** (`hooks/flush.mjs`) — PreCompact surfaces un-triaged inbox items so
  captured-but-unrouted requests don't vanish at a context boundary.

## Acceptance Criteria
- [x] `request-gate.mjs` wired on `Stop` in both `hooks/hooks.json` and
      `user-config/settings.recommended.json`; opt-in-aware (no-op unless `.ai/`).
- [x] **Block-once, loop-proof**: blocks with exit 2 + a one-line nudge; `stop_hook_active`
      short-circuits to exit 0 so it can never loop.
- [x] **Release valves**: a routing receipt (`→ KIT-T### filed` / `… logged`), a
      `[no-capture: reason]` note, OR any new/changed file in an `.ai` capture store this turn.
- [x] **Fail-open**: any error / missing transcript / unadopted repo → exit 0.
- [x] **Tunable, not hardcoded**: `capture.signals` (+ `enabled`, `mode: block-once|warn`) in
      `.ai/config.yml` override the built-in default signal set.
- [x] **Automated test** (`request-gate.test.mjs`): 8 cases (block + 7 allow branches incl.
      loop-proofing + fail-open) over throwaway adopted repos — all pass.
- [x] L3: `flush.mjs` lists un-triaged inbox items; also fixed its stale `.ai/DECISIONS.md`
      reference → `.ai/decisions/` (the dir the project actually uses).

## Notes
- 2026-06-04: HARDENED after it let real requests slip in a live session. Two leaks fixed:
  (1) signals only matched POLITE future-asks; added the blunt/imperative/bug/feel family the
  maintainer actually uses ("there needs to be", "X doesn't feel like", "shouldn't be", "too
  narrow", "fix the", "add a", "make it", "not … enough"). (2) the file-valve counted ANY .ai
  store change — but active work edits the live ticket every turn, holding the valve open;
  restricted it to NEW inbox captures only (ticket/decision captures release via the receipt
  token). +4 tests (12 total). Enforcement is the HOOK, not the agent's memory. Plugin 0.1.11→0.1.12.
- 2026-06-03: Built + tested. Activation needs a session restart / bootstrap re-link (hook
  config loads at session start). `mode: block-once` chosen by maintainer (rigid over warn-only).
- Open follow-on: the inbox naming defect (cap-writer vs README, captured in inbox) and the
  inbox-id-scheme design call (key-prefixed vs date-only) — both fold in near L1.
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
