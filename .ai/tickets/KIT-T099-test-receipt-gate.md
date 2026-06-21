---
id: KIT-T088
title: "Lead with what changed; end every turn with what's TESTABLE (land-alert test-receipt gate)"
type: feature
status: review
priority: high
milestone:
labels: [hooks, dx, contract]
links: [KIT-T021, KIT-T061]
files: [hooks/land-alert.mjs, hooks/land-alert.test.mjs, user-config/CLAUDE.global.md]
supersedes:
superseded_by:
created: 2026-06-21T00:00:00Z
updated: 2026-06-21T00:00:00Z
fixed_commit:
---

## Description
Chris (2026-06-21): "Be brief at the very top of your prose. It's pretty often I can't
tell if work has been done or if you're navel-gazing. At the end of every turn, I NEED
to know what can be fucking tested. That is a KIT capture — codify it now."

Two codified rules:
1. **Lead brief** — the first line of every reply states the result (was work done, or
   not), not the process. Details after.
2. **End with what's TESTABLE** — every turn that lands work must say what to run to test
   it (the exact command / seed / feature), or `[no-test: <reason>]` when nothing is.

Enforcement: the existing `land-alert` Stop gate (KIT-T021) already fires when work
LANDS (a real-work commit this turn) and blocks once unless the reply carries a landing
receipt. Extended so the gate now ALSO requires a TEST receipt — both must be present to
clear, else it nags with the missing part(s). The contract source carries the behavior
rule for every turn; the gate enforces it on landings (the highest-value case).

## Acceptance Criteria
- [x] `land-alert.mjs` requires BOTH a landing receipt AND a test receipt to clear; nag
      lists whichever is missing. `[no-test: <reason>]` satisfies the test half;
      `[no-alert: <reason>]` still suppresses the whole gate.
- [x] Test receipt recognised from a test verb (test/verify/repro), a runner/command
      (cargo, npm, pytest, race_sim, geom_lint, …), "N passed", "nothing to test", or
      `[no-test:]`.
- [x] Contract rule added to `user-config/CLAUDE.global.md` (WORKING RULES): lead with
      what changed; end every turn with what can be tested, or `[no-test:]`.
- [x] Test artifact: `node --test hooks/land-alert.test.mjs` — 14 tests ALL PASS
      (added: landing-but-no-test-receipt → block; landing + `[no-test:]` → allow;
      existing allow-cases updated to carry a test receipt).
- [ ] Re-run `bootstrap.sh` so the new contract rule composes into `~/.claude/CLAUDE.md`
      (Chris, on his machines).

## Notes
- 2026-06-21: implemented in the diverge session. Fail-open preserved (hook contract);
  block-once dedup unchanged (keyed on the landing state). The gate fires only on
  real-work landings, so non-work turns stay silent — the brevity rule (lead with the
  result) is what disambiguates "navel-gazing" on those.
- Possible follow-up: enforce the test receipt on any work-turn (a Write/Edit/build this
  turn), not just commits — broader but noisier; deferred unless asked.
