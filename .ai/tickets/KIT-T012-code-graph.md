---
id: KIT-T012
title: Code graph + automated maintenance — a queryable index of the codebase
type: feature
status: todo
priority: high
milestone:
labels: [code-graph, retrieval, codemap, maintenance]
links: [KIT-T004, KIT-T003, KIT-D012]
files:
  - scripts/code-graph.mjs
  - hooks/
created: 2026-06-03T23:55:00Z
updated: 2026-06-03T23:55:00Z
---

## Description
Maintainer directive (2026-06-03): "is code graph and code graph maintenance part of KIT? If
not, it needs to be." It is NOT today. KIT has only `CODEMAP.md` (a per-project, hand-maintained
flat doc — drifts) and the *workflow-data* relationship graph (KIT-T003/D012, which graphs
work items + docs, NOT code). This adds the code-side analogue of KIT-T004's "query the index,
don't open every file": a generated, maintained graph of the codebase that an agent (or human)
queries — "who calls X", "what imports Y", "where is symbol Z", "what's the public surface of
module M" — instead of grepping and opening files.

Coherent with KIT philosophy: single source of truth = the code; the graph is a DERIVED,
disposable, regenerable index (like the generated INDEX/ROADMAP and the KIT-T004 cache). The
hand-maintained `CODEMAP.md` should become a GENERATED view over the graph (kills the manual
"always update CODEMAP" burden — a standing drift/failure mode).

## Open scope decisions (maintainer — see the question raised on capture)
- **Depth/approach**: lightweight regex/heuristic import+export+symbol extraction (cheap, no
  heavy deps, approximate) VS precise AST/language-server extraction (accurate, per-language
  tooling, heavier). Possibly: lightweight default, precise opt-in.
- **Nodes/edges**: files/modules + exported symbols (fns/classes/types) as nodes; imports,
  references/calls, and the existing layer/gift metadata as edges/attrs.
- **Languages**: KIT itself is `.mjs`; consumers are TS/JS (HOD web), Rust (HOD sim/game),
  others later. Start where? (TS/JS + mjs first is the obvious MVP; Rust next.)
- **Store**: JSON artifact under `.cache/` (gitignored, like KIT-T004's DB) vs rows in the
  KIT-T004 SQLite cache (unifies code + work graphs behind one query layer).
- **Maintenance trigger**: a hook regenerates on code edits (PostToolUse) + a lazy staleness
  check (like KIT-T004 hydration); incremental vs full rebuild.
- **CODEMAP**: becomes generated from the graph? (recommended — removes manual upkeep.)

## Acceptance Criteria (DRAFT — pending the scope decision)
- [ ] `scripts/code-graph.mjs` builds a graph (nodes: files + exported symbols; edges: imports
      + references) for a repo, into a derived, gitignored, fully-rebuildable artifact.
- [ ] A query interface (canned: importers-of, imports-of, defines, references-of, public-surface,
      orphans) returning compact results — for agent retrieval without opening files.
- [ ] Automated maintenance: a hook regenerates/updates on code change + a staleness check;
      optional + fail-open (never wedges a session; no hard dep in the hot-path hooks).
- [ ] CODEMAP generated (or verified) from the graph, retiring the manual "always update" rule.
- [ ] Tests over a fixture repo (deterministic graph; query correctness).

## Plan
1. Settle the scope decisions above with the maintainer (depth, languages, store, CODEMAP).
2. MVP: lightweight TS/JS/mjs import+export graph → JSON artifact + canned queries + tests.
3. Maintenance hook + staleness check.
4. Generate CODEMAP from the graph; extend to Rust; consider folding into the KIT-T004 cache.

## Notes
- 2026-06-03: Captured from the HOD session. Sequencing note: shares a store + query layer with
  KIT-T004 (the SQLite cache) and the KIT-T003 work graph — decide whether code-graph rows live
  in that same cache (one query surface for code + work) or a separate artifact.
