---
id: KIT-T087
title: "File gate → warn-300 / block-600 + code-graph as the navigation layer (token efficiency)"
type: tech-debt
status: done
priority: medium
labels: [hooks, pre-write, contract, tokens, code-graph]
links: [KIT-T073]
files:
  - hooks/pre-write.mjs
  - user-config/CLAUDE.global.md
created: 2026-06-11T00:00:00Z
updated: 2026-06-11T06:00:45Z
---

## Description
Maintainer (2026-06-11): move the file-length gate to a ~300-line target for token usage, and leverage
the code graph ("our codemap") better. Decided via questionnaire: WARN at 300 / hard-BLOCK at 600 (NOT
a hard 300 — that would wall off editing most existing files); and `code-graph` (NOT a new CODEMAP doc)
is the navigation layer — agents locate the ONE small file via the graph instead of reading whole
modules. Smaller files + graph navigation + the existing gates = "read less to do more."

## Acceptance Criteria
- [x] pre-write file gate: `FILE_SOFT` 300 (warn), `FILE_HARD` 600 (block); messages reflect the new
      limits (they template off the constants, so they auto-update).
- [x] The global contract documents code-graph as the navigation layer: find the file via the graph
      (`defines` / `importers-of` / `surface`), read only that small file — connected to the
      file-size gate + the query-gate as the token-efficiency play.

## Notes
- 2026-06-11: warn-300 / block-600 + code-graph-as-map chosen via AskUserQuestion (block-600 over
  hard-300 to avoid blocking edits to existing files; code-graph over a maintained CODEMAP doc).
  [no-test: threshold CONSTANTS + contract prose — the file-length gate LOGIC is unchanged (only the
  two numbers; the message templates auto-reflect them), `npm test` stays green.]

## History
- [2026-06-11 00:00] (created) file-gate 300/600 + code-graph navigation.
- [2026-06-11 06:00] (status) todo → doing
- [2026-06-11 06:00] (comment) ticked: pre-write file gate: `FILE_SOFT` 300 (warn), `FILE_HARD` 600 (block); messages reflect the new
- [2026-06-11 06:00] (comment) ticked: The global contract documents code-graph as the navigation layer: find the file via the graph
- [2026-06-11 06:00] (status) doing → done
