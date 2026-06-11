---
id: KIT-T086
title: "Questionnaire-validator hook — enforce the AskUserQuestion recommendation contract (memory isn't enough)"
type: bug
status: doing
priority: high
labels: [hooks, gates, decisions, questionnaire, agent-discipline]
links: [KIT-T005]
files:
  - hooks/question-gate.mjs
  - hooks/hooks.json
created: 2026-06-11T00:00:00Z
updated: 2026-06-11T05:48:11Z
---

## Description
Lived failure (2026-06-11): the agent shipped an `AskUserQuestion` with the `(Recommended)` marker in
the option DESCRIPTION instead of prepended to the option LABEL — so it isn't actually seen. The rule
is ALREADY written in the contract (DECISIONS: "the recommended option goes FIRST and its **label** is
prefixed `(Recommended)`"), and the agent still got it wrong. Maintainer: "How do I stop you forgetting
this? PROCESS FAILURE." A written rule the agent re-violates is exactly the case for ENFORCEMENT, not a
louder note — the kit's own philosophy ("enforcement is hooks, not judgment"; cf. branch-guard KIT-T082).

Fix: a PreToolUse hook on the `AskUserQuestion` tool that parses `tool_input.questions[]` and BLOCKS
(exit 2) a non-compliant questionnaire, so a bad one can't be shipped.

## Acceptance Criteria
- [x] FIRST verify the harness exposes `AskUserQuestion` to a PreToolUse hook (matcher + payload shape) —
      the same way KIT-T014 verified `Task`. If it is NOT hookable, STOP and report (fall back: a
      louder contract line + a self-check), don't ship a dead hook.
- [x] `hooks/question-gate.mjs` BLOCKS (exit 2) when, for any question: there is no recommended option,
      OR the recommended option is not FIRST, OR the first option's `label` does not start with
      `(Recommended)`. Message quotes the exact rule + the offending question.
- [x] Recognizes a valid questionnaire (first option label starts with `(Recommended)`) and PASSES;
      multiSelect questions handled (each recommended option label prefixed).
- [x] Adopted-repo-agnostic (this is an agent-discipline rule, not a store rule — should fire
      everywhere, or be wired so it always runs); fail-open on any parse error per the HOOK CONTRACT.
- [x] Wired into `hooks/hooks.json` PreToolUse (+ `user-config/settings.recommended.json` mirror).
- [x] Tests: a compliant questionnaire PASSES; each violation (marker-in-description, no-rec,
      rec-not-first) BLOCKS; malformed payload fails open.

## Notes
- 2026-06-11: filed the turn the maintainer caught the violation + asked for a durable fix.
- 2026-06-11: HOOKABILITY CONFIRMED (criterion 1, verified KIT-T014-style). `AskUserQuestion` is a real
  harness tool name and a valid PreToolUse matcher: live transcripts carry `tool_use` blocks named
  `AskUserQuestion` whose `tool_input` is `{ questions: [{ question, header, multiSelect, options: [{
  label, description }] }] }` — and a real one even placed `(Recommended)` on the LABEL, exactly the
  contract this gate enforces. PreToolUse blocks on exit 2 (stderr fed back to Claude — hooks docs).
  The official hooks page does not enumerate every tool (so its silence on `AskUserQuestion` is not
  evidence of absence); the running harness is the authoritative source, like KIT-T014's `Task` check.
- 2026-06-11: BUILT `hooks/question-gate.mjs` (PreToolUse, matcher `AskUserQuestion`, NOT gated on `.ai/`
  adoption — agent-discipline; fail-open on any error). Blocks exit 2 when, per question: (a) no option
  LABEL starts with `(Recommended)` — message escalates to "marker is in the DESCRIPTION" when the word
  hides there (the lived bug); (b) single-select recommended option isn't FIRST. multiSelect relaxes (b)
  (each recommended LABEL marked, order free) but still requires ≥1 recommendation. Message quotes the
  rule + names the offending question (header). Wired into `hooks/hooks.json` PreToolUse + the
  `user-config/settings.recommended.json` bootstrap mirror; `hooks/README.md` table row added. Tests:
  `hooks/question-gate.test.mjs` (19 assertions: compliant single + multi PASS; marker-in-description /
  no-rec / rec-not-first / multi-no-rec / second-question-bad BLOCK; non-JSON, empty, no-questions,
  empty-options, wrong-tool, lowercase/padded-marker FAIL-OPEN/allow) — all pass; wired into `npm test`.
  Full suite green (test-hooks 111, request-gate 29, agent-roster 35, query/question/exclusions all pass,
  ingest 10, sync-data, id-utils 19, t 49, code-graph 33, db-cache 66, triage 10). pre-write gate clean.

## History
- [2026-06-11 00:00] (created) questionnaire-validator hook from a lived recommendation-placement miss.
- [2026-06-11 05:48] (status) todo → doing
- [2026-06-11 05:54] (comment) ticked: FIRST verify the harness exposes `AskUserQuestion` to a PreToolUse hook (matcher + payload shape) —
- [2026-06-11 05:54] (comment) ticked: Recognizes a valid questionnaire (first option label starts with `(Recommended)`) and PASSES;
- [2026-06-11 05:54] (comment) ticked: Wired into `hooks/hooks.json` PreToolUse (+ `user-config/settings.recommended.json` mirror).
- [2026-06-11 05:54] (comment) ticked: `hooks/question-gate.mjs` BLOCKS (exit 2) when, for any question: there is no recommended option,
- [2026-06-11 05:54] (comment) ticked: Adopted-repo-agnostic (this is an agent-discipline rule, not a store rule — should fire
- [2026-06-11 05:54] (comment) ticked: Tests: a compliant questionnaire PASSES; each violation (marker-in-description, no-rec,
