---
id: KIT-T033
title: "request-gate false-positives on harness task-notification / system-notice blocks"
type: bug
status: done
priority: medium
milestone:
labels: [hooks, request-gate, false-positive, dx]
links: [KIT-T005]
aka: []
files:
  - hooks/request-gate.mjs
  - hooks/request-gate.test.mjs
created: 2026-06-05T00:00:00Z
updated: 2026-06-10T06:00:00Z
---

## Description
The Stop-phase request-gate (`hooks/request-gate.mjs`) treats harness-injected user-role
blocks — `<task-notification>` (background-agent completions), `[SYSTEM NOTIFICATION ...]`,
`<system-reminder>`, and its own echoed `Stop hook feedback:` — as the "last user message".
Their request-shaped text (an agent result saying "...doesn't work... we should...") trips
the gate, so it nagged "Possible un-captured request" four times in one session on pure
system noise.

## Acceptance Criteria
- [x] `parseTranscript` skips harness-injected system notices when selecting the real last
      user message (matches `<task-notification`, `<system-reminder`, `[SYSTEM NOTIFICATION`,
      `Stop hook feedback:`).
- [x] A genuine request that arrives BEFORE a later task-notification is still caught.
- [x] Tests cover both (task-notification ignored; real request behind a notification still blocks).

## Notes
- 2026-06-05: Fixed via `isSystemNotice()` skip in `parseTranscript`. +2 tests; request-gate
  suite 14/14, full suite green. Correctness fix (ignore non-user system text) — the actual
  request-detection rule is unchanged, not loosened. Maintainer-approved the fix.
- 2026-06-05 (recurrence + harder fix): the prefix regex missed slash-command/skill prompt
  expansions ("Classify and route the following…", "Read-only standup…") — request-shaped text
  on the SKILL's OWN instructions tripped the gate. Root cause: those arrive as user-role
  entries flagged `isMeta: true` (with a `sourceToolUseID`), which the prefix match didn't
  cover. Primary guard is now `e.isMeta !== true` in `parseTranscript`; `isSystemNotice` kept
  as a fail-safe. Proven against the live transcript that broke. +2 tests (skill prompt skipped;
  real request behind a later skill prompt still blocks). Suite 16/16.
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
