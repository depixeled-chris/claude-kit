---
id: KIT-T100
title: sessions.db: ingest Claude Code session transcripts into a separate FTS5 SQLite cache + q sessions/session/said query surface (timestamped cross-terminal history, lazy query-time ingest)
type: feature
status: review
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-07-10T05:04:26Z
updated: 2026-07-10T05:13:24Z
---

## Description
Chris runs multiple terminals and cannot reconstruct what was said when/where — Claude Code
shows no timestamps and offers no search. It DOES already log every session (per-terminal
jsonl transcripts with per-line timestamps, ~750 MB on the Windows box). Build the missing
reader: ingest conversation text (user prompts + assistant replies ONLY — no tool dumps)
into a SQLite FTS5 cache and expose it through `q`. Maintainer decisions (2026-07-09/10):
SQLite for full-text search; SEPARATE sessions.db, not workflow.db (rebuild-lifecycle +
hot-write-path isolation — two files, one engine, one `q` front door); lazy query-time
ingest (zero cost to live sessions; WAL + fail-open handles concurrent terminals).
Consolidates inbox -1550 (timestamps) and -0147 (FTS recall for the KIT process; the
SESSION.md-diet process change is follow-up scope, not this ticket).

## Acceptance Criteria
- [x] `q sessions` lists terminal sessions newest-first with local start/end times, project,
      message count, and a first-prompt label
- [x] `q session <id-prefix>` dumps one session as timestamped `[date time] you/claude:` lines
- [x] `q said <words...>` full-text searches across all sessions with timestamped snippets
- [x] ingest is incremental (unchanged transcripts skip) and fail-open per file; parser
      survives noise lines, sidechains, and malformed JSON (defensive against the
      documented-unstable transcript format)
- [x] no-engine fallback: sessions/session degrade to direct file reads; said says why it can't
- [x] tests in the suite; real-machine backfill receipts recorded

## Plan
1. scripts/session-ingest.mjs — defensive parser + incremental FTS5 ingest (separate sessions.db)
2. scripts/q-sessions.mjs — sessions/session/said surface, lazy ingest, no-engine fallbacks
3. q.mjs — 3-command delegation + usage lines
4. session-ingest.test.mjs — fixtures for parser, ingest, FTS, q dump; wire into npm test

## History
- [2026-07-10 05:04] (created) feature — sessions.db: ingest Claude Code session transcripts into a separate FTS5 SQLite cache + q sessions/session/said query surface (timestamped cross-terminal history, lazy query-time ingest)
- [2026-07-10 05:04] (status) todo → doing
- [2026-07-10 05:12] (comment) ticked: `q sessions` lists terminal sessions newest-first with local start/end times, project,
- [2026-07-10 05:12] (comment) ticked: `q session <id-prefix>` dumps one session as timestamped `[date time] you/claude:` lines
- [2026-07-10 05:12] (comment) ticked: `q said <words...>` full-text searches across all sessions with timestamped snippets
- [2026-07-10 05:12] (comment) ticked: ingest is incremental (unchanged transcripts skip) and fail-open per file; parser
- [2026-07-10 05:12] (comment) ticked: no-engine fallback: sessions/session degrade to direct file reads; said says why it can't
- [2026-07-10 05:12] (comment) ticked: tests in the suite; real-machine backfill receipts recorded
- [2026-07-10 05:13] (status) doing → review
- [2026-07-10 05:13] (comment) shipped; awaiting maintainer /done. q sessions 172ms on real data
