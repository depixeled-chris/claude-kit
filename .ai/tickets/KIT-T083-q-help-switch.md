---
id: KIT-T083
title: "q: add --help / -h usage output (currently exits 2 'unknown query')"
type: feature
status: todo
priority: low
milestone:
labels: [cli, dx]
links: [KIT-T050]
files: [scripts/q.mjs]
supersedes:
superseded_by:
created: 2026-06-10T20:34:46Z
updated: 2026-06-10T20:34:46Z
---

## Description
`q --help` (and bare `q` with no args) gives no usage — it exits 2 with
`q: unknown query '--help'.` Since the query gate (KIT-T050) pushes agents and
humans toward `q` as the primary interface to the store, discoverability matters:
the tool should describe itself.

Add a help switch that prints:
- the canned queries from `cannedQueries(root)` (name + one-line purpose)
- the fallback subcommands (`open`, `children`, `backlinks`, `by-commit`,
  `doc-trail`/`trail`, `fts`, `rundown`, `regressions`, `supersedes`, `similar`,
  `next-id`, `governing`, `drift`) with their arg shapes
- global flags (e.g. `--json`)

Help text should be generated from the same tables that drive dispatch (single
source of truth — a hand-maintained usage string will drift).

## Acceptance Criteria
- [ ] `q --help`, `q -h`, and `q help` print usage and exit 0.
- [ ] Bare `q` (no args) prints the same usage (exit 0 or 2 — pick and document).
- [ ] Every canned query and every fallback subcommand appears in the output, sourced from the dispatch tables, not a parallel hardcoded list.
- [ ] Unknown queries still exit 2 but now append "run `q --help` for usage".
- [ ] Test artifact: unit test covering help output lists all dispatch keys.

## Plan
1. Extract a usage() that walks cannedQueries(root) keys + the fallback switch table.
2. Intercept `--help`/`-h`/`help`/no-args before dispatch.
3. Append help hint to the unknown-query error path.
4. Add test asserting help output ⊇ dispatch keys.

## Notes
- 2026-06-10: filed from hustle-or-die session — agent tried `q --help` to learn the surface and got exit 2 with no guidance.
