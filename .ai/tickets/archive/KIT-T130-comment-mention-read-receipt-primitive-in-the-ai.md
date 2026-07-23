---
id: KIT-T130
title: Comment + @mention + read-receipt primitive in the .ai store — UI comments agents pick up at session start
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T129, KIT-D044]
files: []
supersedes:
superseded_by:
created: 2026-07-23T15:15:30Z
updated: 2026-07-23T15:33:12Z
---

## Description
The phase-1 foundation of KIT-T129: re-back workflow's comment → @mention →
read-receipt pull pattern (harvest verdict in KIT-T129 Notes) with the .ai store. A
comment posted anywhere (UI/API later; CLI now) lands DURABLY in the ticket file;
@mentions are derived on read (regex /@([\w-]+)/g, never stored); per-agent read
receipts live in the store so acks survive machines; unread mentions surface at
session start/drain so a tabula-rasa agent picks them up without a built context.

Constraints (KIT-D037/KIT-D044): History = structured one-line stamped events; Notes =
prose. A comment is a History `(comment)` event carrying author + text (config
history.events already includes `comment`); long prose bodies may spill to Notes with
the event referencing them. Writes go through t.mjs code paths + view regen; markdown
stays the only truth.

## Acceptance Criteria
- [x] `t comment <id> "<text>" --author <who>` appends a durable comment to the ticket file (History `(comment)` event; multi-line body handled) and refreshes views
- [x] @mentions derived on read: `q mentions <agent>` lists comments mentioning the agent across the project, with unread state
- [x] Read receipts: an ack verb (e.g. `t ack <id>#<comment-ref> --agent <name>`) records a per-agent seen marker in the store; acked mentions stop surfacing
- [x] orient (SessionStart) and /drain surface unread mentions for the acting agent
- [x] Tests cover comment append, mention derivation, ack lifecycle, and unread surfacing (node --test, repo convention)

## Plan
1. Comment event format + spill-to-Notes rule in t.mjs (share appendUnderSection).
2. Mention derivation + unread query in q.mjs; seen-marker sidecar in .ai/.
3. orient/drain surfacing + ack verb + tests.

## History
- [2026-07-23 15:15] (created) feature — Comment + @mention + read-receipt primitive in the .ai store — UI comments agents pick up at session start
- [2026-07-23 15:20] (status) todo → doing
- [2026-07-23 15:32] (comment) ticked: `t comment <id> "<text>" --author <who>` appends a durable comment to the ticket file (History `(comment)` event; multi-line body handled) and refreshes views
- [2026-07-23 15:32] (comment) ticked: @mentions derived on read: `q mentions <agent>` lists comments mentioning the agent across the project, with unread state
- [2026-07-23 15:32] (comment) ticked: Read receipts: an ack verb (e.g. `t ack <id>#<comment-ref> --agent <name>`) records a per-agent seen marker in the store; acked mentions stop surfacing
- [2026-07-23 15:32] (comment) ticked: orient (SessionStart) and /drain surface unread mentions for the acting agent
- [2026-07-23 15:32] (comment) ticked: Tests cover comment append, mention derivation, ack lifecycle, and unread surfacing (node --test, repo convention)
- [2026-07-23 15:33] (comment) @claude: Implemented: scripts/comments.mjs (model), t.mjs comment+ack verbs, q.mjs mentions query, orient + drain surfacing. Test (full comment #1 in ## Notes)
### comment #1 [2026-07-23 15:33] @claude
Implemented: scripts/comments.mjs (model), t.mjs comment+ack verbs, q.mjs mentions query, orient + drain surfacing. Tests: scripts/comments.test.mjs — 35 passed, 0 failed. Full suite green (npm test exit 0; t: 49 passed). @chris ready for review.
- [2026-07-23 15:33] (status) doing → done
