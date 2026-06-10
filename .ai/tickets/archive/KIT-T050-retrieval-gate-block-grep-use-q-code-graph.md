---
id: KIT-T050
title: Retrieval gate — block grepping the .ai store + tree-wide source greps; redirect to q / code-graph
type: feature
status: done
priority: high
milestone:
labels: [retrieval, hooks, enforcement, q, code-graph]
links: [KIT-T004, KIT-T012, KIT-T026]
files:
  - hooks/query-gate.mjs
  - hooks/query-gate.test.mjs
  - hooks/hooks.json
  - hooks/orient.mjs
created: 2026-06-06T00:00:00Z
updated: 2026-06-10T06:00:00Z
---

## Description
Lived failure (2026-06-06): an agent hand-grepped `.ai/` for decisions/tickets/history and
grepped the source tree to discover code, instead of using the layers built for exactly that —
`q` (KIT-T004 cache) and `code-graph` (KIT-T012). Maintainer: "claude-kit SHOULD BE DICTATING
your lookup process… we have a trail for every action and a SQLite database tying it together
which should provide faster search on issue tracking against history." And: "look at the code
graph first instead of grepping files. Grepping files is OK IF YOU KNOW PRECISELY WHERE YOU'RE
LOOKING AND FOR WHAT."

Instructions are advisory — a blank context blows past them. The fix is enforcement, per the
KIT contract ("enforcement is hooks, not judgment"): a PreToolUse gate that closes the shell
path so the wrong action is impossible, and a SessionStart line so the agent reaches for the
query tools proactively (not only when blocked).

## Acceptance criteria
- [x] PreToolUse(Bash|PowerShell) hook `query-gate.mjs` blocks (exit 2) a text tool
      (grep/rg/sed/awk/find/cat/Select-String/git grep) that searches or reads the `.ai` work
      store, returning the equivalent `q` query in the denial message.
- [x] Blocks a recursive / tree-wide source search (discovery) and returns `code-graph --query`
      forms (importers-of / defines / surface).
- [x] ALLOWS the maintainer's exceptions: a targeted grep of a SPECIFIC named file, and piped
      filtering of a command's OUTPUT (`q sql … | grep`, `git log | grep`).
- [x] No-ops on unadopted repos; fail-open on any parse error (never wedges a tool call).
- [x] Registered in `hooks/hooks.json`; SessionStart `orient.mjs` carries the QUERY-don't-grep
      rule as PROCESS RULE #1.
- [x] Automated test `query-gate.test.mjs` (15 cases: store search, source discovery, the
      allowed exceptions, q/code-graph passthrough, unadopted) wired into `npm test`; full suite green.

## Notes
- 2026-06-06: Implemented + tested. Discovery heuristic: rg/ag/ack and `git grep` are recursive
  by default → blocked unless a concrete single-file arg is present; grep is blocked only with a
  recursive flag or directory arg. Only the pipeline LEADER (pre-first-pipe, split on &&/;) is
  judged so output filters pass. Follow-up candidates: extend to the Grep/Glob TOOLS path is
  unnecessary (those already are the right tools); consider a `q`-backed CODEMAP generated view
  (KIT-T012) and consuming the cache everywhere (KIT-T026).
- 2026-06-10: (status) review -> done — UAT sweep per KIT-D034 (uat: none for claude-kit; maintainer delegated acceptance). Evidence: ticket Notes + cited commits; shipped tooling in daily use.
