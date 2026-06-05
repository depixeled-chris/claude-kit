---
id: KIT-T033
title: "request-gate false-positives on harness task-notification / system-notice blocks"
type: bug
status: review
priority: medium
milestone:
labels: [hooks, request-gate, false-positive, dx]
links: [KIT-T005]
aka: []
files:
  - hooks/request-gate.mjs
  - hooks/request-gate.test.mjs
created: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
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
