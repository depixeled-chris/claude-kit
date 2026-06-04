---
id: KIT-T012
title: Code graph + automated maintenance — a queryable index of the codebase
type: feature
status: doing
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

## Decided (2026-06-03)
- **Must work for ANY language** (maintainer). Approach = a DATA table of per-family line
  patterns + a GENERIC fallback applied to every file, so unknown languages still yield a
  graph. Zero runtime deps (KIT's hooks are dep-free; `ctags` isn't installed here). Accuracy
  is heuristic; tree-sitter (grammars = any language, precise) is the OPT-IN upgrade — but it
  would be KIT's first runtime dep, so it's a separate maintainer call (see below).

## Acceptance Criteria
- [x] `scripts/code-graph.mjs` builds a graph (nodes: files + symbols; edges: import, with an
      `external` flag for bare specifiers) for a repo, into a derived, gitignored
      (`.cache/`), fully-rebuildable JSON artifact. Any-language (js/ts, python, rust, go,
      c-family + generic fallback). Dogfooded: claude-kit (28 files) + HOD (641, incl. submodule).
- [x] Query interface (canned: `importers-of`, `defines`, `surface`) returning compact JSON —
      agent retrieval without opening files. (Verified: `importers-of id-utils.mjs` → the 6 real importers.)
- [x] Tests over a multi-language fixture (deterministic graph + query correctness); 10 cases, in `npm test`.
- [ ] Automated maintenance: a hook regenerates/updates on code change + staleness check.
      **DECISION-GATED**: adds a hook that runs on every code edit across ALL adopted repos —
      maintainer should weigh the perf/behavior impact before it's wired repo-wide.
- [x] CODEMAP **verified** (not generated) from the graph — `--codemap-check <file>` flags
      UNDOCUMENTED (code files absent from CODEMAP) + STALE (code-path entries pointing at no
      file), exit 1 on drift. Chose verify over full-generate: generating would destroy
      CODEMAP's hand-curated role/layer/**gift-status** (the open-core boundary), which a graph
      can't infer. Suffix-aware matching (tolerates CODEMAP dropping `src/`); stale only flags
      code-extension tokens (docs/symbol-mentions aren't false-flagged). +3 tests; low-noise on
      HOD's real CODEMAP. (Full merge-generation possible later if wanted, preserving curated columns.)
- [ ] (Optional) tree-sitter accuracy upgrade for real call/reference edges — **adds a runtime dep**.
- [x] Submodule/.gitignore awareness — file list comes from `git ls-files` (tracked +
      untracked-not-ignored), which respects `.gitignore` and excludes submodule internals;
      falls back to an FS walk in non-git dirs. HOD now 83 files (was 641 incl. rapid-game). +2 tests.

## Plan
1. Settle the scope decisions above with the maintainer (depth, languages, store, CODEMAP).
2. MVP: lightweight TS/JS/mjs import+export graph → JSON artifact + canned queries + tests.
3. Maintenance hook + staleness check.
4. Generate CODEMAP from the graph; extend to Rust; consider folding into the KIT-T004 cache.

## Notes
- 2026-06-03: Captured from the HOD session. Sequencing note: shares a store + query layer with
  KIT-T004 (the SQLite cache) and the KIT-T003 work graph — decide whether code-graph rows live
  in that same cache (one query surface for code + work) or a separate artifact.
- 2026-06-03: MVP landed — `scripts/code-graph.mjs` + `code-graph.test.mjs` (10/10). Built the
  dep-free any-language baseline per the "any language" decision. The remaining criteria are
  DECISION-GATED (a global maintenance hook; CODEMAP-from-graph; a tree-sitter dep) — surfaced
  to the maintainer rather than auto-wired, since each changes shared behavior or adds a dep.
