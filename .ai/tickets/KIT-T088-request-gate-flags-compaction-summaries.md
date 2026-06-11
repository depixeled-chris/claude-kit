---
id: KIT-T088
title: request-gate flags harness compaction summaries as un-captured requests
type: bug
status: todo
priority: medium
milestone:
labels: [hooks, request-gate, false-positive]
files: [hooks/request-gate.mjs]
tier: quick
links: []
created: 2026-06-12T00:45:00Z
updated: 2026-06-12T00:45:00Z
---

## Description
After a context compaction, the harness injects a continuation message
beginning "This session is being continued from a previous conversation that
ran out of context. The summary below covers the earli…". The Stop-time
request-gate treats that injected text as a possible un-captured user request
and blocks every turn of the resumed session until the reply carries a
`[no-capture: ...]` marker — observed twice in one marblerace2 session
(2026-06-12). The summary is harness-generated, never a user request;
anything actionable in it is already on disk (tickets/SESSION.md) per the
workflow's own flush discipline.

## Acceptance Criteria
- [ ] request-gate.mjs ignores harness-injected continuation/summary text
      (e.g. skip candidates matching the known continuation preamble, or any
      message the transcript marks as synthetic/compact rather than typed by
      the user).
- [ ] A genuine user request appearing in the SAME resumed turn is still
      flagged (the filter is scoped to the injected summary, not the turn).
- [ ] Regression test in the hook's test suite: a compaction-continuation
      transcript produces no warning; a real request still does.

## Plan
1. Inspect how request-gate.mjs extracts request candidates from the
   transcript; identify where the continuation message enters.
2. Prefer a structural signal (message role/flags marking synthetic
   compaction content) over string-matching the preamble; fall back to the
   known preamble prefix if no structural marker exists.
3. Add fixture + test; verify against the marblerace2 session transcript.

## History
- [2026-06-12 00:45] (created) reported by Chris from marblerace2 session:
  hook fired twice on the same injected compaction summary; replies needed
  manual `[no-capture]` markers both times.
