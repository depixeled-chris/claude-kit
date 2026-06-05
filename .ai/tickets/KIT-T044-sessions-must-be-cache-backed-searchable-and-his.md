---
id: KIT-T044
title: Sessions must be cache-backed, searchable, and history-tracked across sessions (not one overwritten SESSION.md). Today: orient.mjs:100 raw file-reads SESSION.md; the DB cache+FTS ingests only .ai stores (db-parse), so the session summary is never a row, never searchable via q.mjs — a KIT-D024 violation (index is the SOLE read surface). Wanted: (1) session open/close are first-class boundary events; (2) each session = an append/versioned record (clean breaks, queryable history), not a clobbered file; (3) summaries ingested into items+FTS like any store; (4) orient loads the latest session summary FROM the cache, not a raw head() of the file. Touches: new SESSION store + db-parse, hydrate/sync, orient.mjs, flush.mjs.

ORPHAN CEREMONY (added): open/close are PAIRED lifecycle events; a session that started but never properly closed (crash, /clear or end without flush, machine died) is an ORPHAN. On SessionStart, detect the unclosed prior session and CLOSE IT with the proper ceremony (flush a final summary, stamp a close/boundary event, mark it closed in the store) BEFORE opening the new one — never silently overwrite/adopt. So: SessionStart = reconcile-then-open (close any orphan first), SessionEnd/PreCompact/Stop = clean close. State machine: open -> closed | orphaned->closed. This makes "clean breaks" enforced, not best-effort.
type: feature
status: todo
priority: medium
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
links: [KIT-T026, KIT-T014, KIT-T006]
files: []              # repo-root-relative paths this ticket touches
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-06-05T20:35:28.988Z
updated: 2026-06-05T20:35:28.988Z
---

## Description
Sessions must be cache-backed, searchable, and history-tracked across sessions (not one overwritten SESSION.md). Today: orient.mjs:100 raw file-reads SESSION.md; the DB cache+FTS ingests only .ai stores (db-parse), so the session summary is never a row, never searchable via q.mjs — a KIT-D024 violation (index is the SOLE read surface). Wanted: (1) session open/close are first-class boundary events; (2) each session = an append/versioned record (clean breaks, queryable history), not a clobbered file; (3) summaries ingested into items+FTS like any store; (4) orient loads the latest session summary FROM the cache, not a raw head() of the file. Touches: new SESSION store + db-parse, hydrate/sync, orient.mjs, flush.mjs.

ORPHAN CEREMONY (added): open/close are PAIRED lifecycle events; a session that started but never properly closed (crash, /clear or end without flush, machine died) is an ORPHAN. On SessionStart, detect the unclosed prior session and CLOSE IT with the proper ceremony (flush a final summary, stamp a close/boundary event, mark it closed in the store) BEFORE opening the new one — never silently overwrite/adopt. So: SessionStart = reconcile-then-open (close any orphan first), SessionEnd/PreCompact/Stop = clean close. State machine: open -> closed | orphaned->closed. This makes "clean breaks" enforced, not best-effort.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
