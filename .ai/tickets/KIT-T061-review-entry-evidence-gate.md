---
id: KIT-T061
title: Entering review requires test evidence (or an explicit [no-test: reason]) — UAT gets a floor
type: feature
status: review
priority: high
milestone: M2-close-the-loop
labels: [hooks, gates, lifecycle, uat]
files:
  - hooks/ingest-data.mjs
  - hooks/commit-gate.mjs
links: [KIT-T060]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-10T18:12:43Z
---

## Description
Acceptance-criteria checkboxes are self-asserted by the model; nothing requires evidence
to move `doing → review`. The contract demands "a test-backed basis for any 'it's fixed'
claim", but it is enforced nowhere — so review means "Claude says it works". Give UAT a
structural floor, same philosophy as the commit gate's `[no-log:]`: the only non-evidence
path is an explicit, documented escape.

Mechanism: when a ticket file's status changes to `review` (detectable in the PostToolUse
ingest path or at commit time), require its Notes/History to cite a test artifact (test
file path, `npm test` output reference, or test commit sha) OR carry `[no-test: reason]`.

## Acceptance Criteria
- [x] The CLOSING transition without test evidence or `[no-test: reason]` is blocked (exit 2) with a message naming exactly what to add. Closing transition = doing→review where `config.uat` is `required`, doing→done where `none` (KIT-D034) — the evidence floor applies in BOTH modes; uat only changes who accepts.
- [x] Evidence patterns documented (test path, suite-run reference, sha).
- [x] Fail-open on malformed payloads/tickets per HOOK CONTRACT.
- [x] Tests: blocked transition, evidence-satisfied transition, no-test escape, non-status edits unaffected.
- [x] Template + CLAUDE.snippet.md document the requirement.

## Plan
1. Detect status transitions in the write path (old frontmatter vs new).
2. Evidence scan + escape; block message.
3. Tests + docs.

## Notes
- 2026-06-09: opened from the lifecycle review (UAT stage has no machinery).
- 2026-06-10: SHIPPED. Logic lives in one place — `evidenceFloor(text, uatDefault)` in
  scripts/t.mjs (closing = doing→review when uat `required`, doing→done when `none`; evidence
  = a test path / suite-run ref / sha; escape = `[no-test: reason]`). The BLOCK is in
  hooks/commit-gate.mjs (exit 2, names the ticket + what to add), placed BEFORE the
  plan-of-record early-allow so touching the ticket can't bypass it; transition = staged status
  == closing while HEAD's != closing, so re-touching an already-closed ticket never blocks. An
  ADVISORY warn rides in hooks/ingest-data.mjs to catch a hand-edit that bypasses the `t` CLI.
  Both fail-open. Docs: _TEMPLATE.md + project-template/CLAUDE.snippet.md. Tests: 6 evidenceFloor
  unit cases (scripts/t.test.mjs) + 4 commit-gate integration cases (block / evidence-pass /
  [no-test:] escape / non-closing edit unaffected) in scripts/test-hooks.mjs. Full suite green.

## History
- [2026-06-10 18:03] (status) todo → doing
- [2026-06-10 18:12] (comment) ticked: The CLOSING transition without test evidence or `[no-test: reason]` is blocked (exit 2) with a message naming exactly what to add. Closing transition = doing→review where `config.uat` is `required`, doing→done where `none` (KIT-D034) — the evidence floor applies in BOTH modes; uat only changes who accepts.
- [2026-06-10 18:12] (comment) ticked: Evidence patterns documented (test path, suite-run reference, sha).
- [2026-06-10 18:12] (comment) ticked: Fail-open on malformed payloads/tickets per HOOK CONTRACT.
- [2026-06-10 18:12] (comment) ticked: Tests: blocked transition, evidence-satisfied transition, no-test escape, non-status edits unaffected.
- [2026-06-10 18:12] (comment) ticked: Template + CLAUDE.snippet.md document the requirement.
- [2026-06-10 18:12] (status) doing → review
