---
id: KIT-T147
title: Send Back requires a comment — inline comment box under the control; API rejects backward transitions without one
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:15:05Z
updated: 2026-07-23T18:15:05Z
---

## Description
Maintainer rule 2026-07-23: "Sending anything back without a comment is useless to an
agent." A send-back (a backward status transition — review → doing/todo) exists to
hand work back with a reason; without one, the receiving agent has nothing to act on.
UI: clicking Send Back reveals an INLINE comment box directly beneath the control with
its own submit; submit is disabled until non-empty text. The comment posts through the
KIT-T130 comment path (durable, @mention-able — it auto-@mentions the acting agent so
it lands in the mention inbox) and the status transition rides with it.
Enforcement is structural, not UI-courtesy: the API rejects a backward transition with
no comment (422 with a guard message) so ANY client — curl included — is held to it.

## Acceptance Criteria
- [ ] API: POST .../status accepts an optional comment {text}; backward transitions (per the project's configured flow order) WITHOUT one are rejected 422 with a clear guard message; with one, the comment lands durably (History (comment) event) before the status event
- [ ] UI: Send Back reveals an inline comment box + submit beneath the control; submit disabled while empty; guard 422 surfaced inline if it slips through
- [ ] The send-back comment auto-@mentions the agent identity so it surfaces in the mention inbox (KIT-T130 loop)
- [ ] Round-trip test: send-back without comment → 422; with comment → status changed + comment durable + mention derived
- [ ] ui build + full npm test green

## Plan
1. Server: backward-transition detection (flow order from config) + comment-required guard in the status write service.
2. UI: StatusControls inline send-back form (after KIT-T145 reworks identity there).
3. Tests + ui:build for the live server.

## History
- [2026-07-23 18:15] (created) feature — Send Back requires a comment — inline comment box under the control; API rejects backward transitions without one
