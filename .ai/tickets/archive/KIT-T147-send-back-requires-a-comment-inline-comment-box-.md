---
id: KIT-T147
title: Send Back requires a comment — inline comment box under the control; API rejects backward transitions without one
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T132, KIT-T130, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:15:05Z
updated: 2026-07-23T19:11:42Z
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
- [x] API: POST .../status accepts an optional comment {text}; backward transitions (per the project's configured flow order) WITHOUT one are rejected 422 with a clear guard message; with one, the comment lands durably (History (comment) event) before the status event
- [x] UI: Send Back reveals an inline comment box + submit beneath the control; submit disabled while empty; guard 422 surfaced inline if it slips through
- [x] The send-back comment auto-@mentions the agent identity so it surfaces in the mention inbox (KIT-T130 loop)
- [x] Round-trip test: send-back without comment → 422; with comment → status changed + comment durable + mention derived
- [x] ui build + full npm test green

## Plan
1. Server: backward-transition detection (flow order from config) + comment-required guard in the status write service.
2. UI: StatusControls inline send-back form (after KIT-T145 reworks identity there).
3. Tests + ui:build for the live server.

## History
- [2026-07-23 18:15] (created) feature — Send Back requires a comment — inline comment box under the control; API rejects backward transitions without one
- [2026-07-23 19:03] (status) todo → doing
- [2026-07-23 19:11] (comment) ticked: API: POST .../status accepts an optional comment {text}; backward transitions (per the project's configured flow order) WITHOUT one are rejected 422 with a clear guard message; with one, the comment lands durably (History (comment) event) before the status event
- [2026-07-23 19:11] (comment) ticked: UI: Send Back reveals an inline comment box + submit beneath the control; submit disabled while empty; guard 422 surfaced inline if it slips through
- [2026-07-23 19:11] (comment) ticked: The send-back comment auto-@mentions the agent identity so it surfaces in the mention inbox (KIT-T130 loop)
- [2026-07-23 19:11] (comment) ticked: Round-trip test: send-back without comment → 422; with comment → status changed + comment durable + mention derived
- [2026-07-23 19:11] (comment) ticked: ui build + full npm test green
- [2026-07-23 19:11] (comment) @claude: Evidence: server/server.test.mjs 22/22 incl. send-back round-trip (review->doing bare -> 422 send_back_needs_comment; wi (full comment #1 in ## Notes)
### comment #1 [2026-07-23 19:11] @claude
Evidence: server/server.test.mjs 22/22 incl. send-back round-trip (review->doing bare -> 422 send_back_needs_comment; with comment -> 200, comment durable + auto-@mention + surfaces in the agent inbox + comment precedes the status event in the markdown). Full npm test EXIT=0 (db-cache clean, identity 6/6). cd ui && npm run build green (80 modules). Backend: writes.setTicketStatus detects backward transitions via config flow order, 422s without a comment, else lands the comment FIRST (auto-@mentioning last-non-user author or resolveAgent()) then the status. UI StatusControls reveals an inline reason box for any backward move (submit disabled while empty, 422 surfaced inline). ALSO folded in the coordinator's KIT-T137 fix: setProjectDisplayName now escapes backslashes+quotes YAML-double-quoted (readDisplayName unescapes), removed the quote rejection (kept newline/CR + 48-char cap); new test round-trips a quoted name verbatim.
- [2026-07-23 19:11] (status) doing → done
