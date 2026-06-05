---
id: KIT-T040
title: inbox cap-writer disagrees with inbox/README.md naming standard.

README documents `YYYY-MM-DD-HHMM-<slug>.md` (4-digit time). Actual files use a
2-digit counter instead of HHMM, e.g. `2026-06-02-00-...`, `-02-`, `-03-`. So `cap`
(or whatever writes inbox files) and the README disagree — pick one and make them
match. Separately (design call, not a bug): inbox is intentionally OUTSIDE the
KEY-T### id space (pre-triage buffer, items get ids only when promoted) — confirm
that's the desired convention or adopt a key-prefixed scheme. Surfaced 2026-06-03;
relates to KIT request-ratchet Layer 1 (INBOX standardization).
type: bug
status: superseded
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
links: []
files: []              # repo-root-relative paths this ticket touches
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-06-05T20:16:00.313Z
updated: 2026-06-05T20:16:00.313Z
---

## Description
inbox cap-writer disagrees with inbox/README.md naming standard.

README documents `YYYY-MM-DD-HHMM-<slug>.md` (4-digit time). Actual files use a
2-digit counter instead of HHMM, e.g. `2026-06-02-00-...`, `-02-`, `-03-`. So `cap`
(or whatever writes inbox files) and the README disagree — pick one and make them
match. Separately (design call, not a bug): inbox is intentionally OUTSIDE the
KEY-T### id space (pre-triage buffer, items get ids only when promoted) — confirm
that's the desired convention or adopt a key-prefixed scheme. Surfaced 2026-06-03;
relates to KIT request-ratchet Layer 1 (INBOX standardization).

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
