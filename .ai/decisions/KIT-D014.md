---
id: KIT-D014
title: "Code graph stays zero-dep by default; tree-sitter is an optional accuracy cascade with a bundled curated grammar set"
date: 2026-06-03
---

Decided (maintainer, via the decision questionnaire): the code graph (KIT-T012) keeps its
**dependency-free heuristic extractor as the always-on floor** (works for any text file, no
deps), and adds **tree-sitter as an OPTIONAL precision layer** in a cascade — when
`web-tree-sitter` + a grammar are present, use precise `tags.scm` definition/reference
extraction; otherwise fall back to the heuristic. Mirrors KIT-T004's engine cascade
(better-sqlite3 → node:sqlite → markdown scan). Grammar-management strategy = **bundle a
curated core set** (`.wasm` + queries for ~js/ts/py/rust/go, drop-in for more), not on-demand
fetch (network/non-deterministic) nor a required tree-sitter CLI (setup burden).

Why: "must work for any language" + "runs anywhere" both hold — the heuristic floor guarantees
the latter even with no deps; tree-sitter raises accuracy where grammars are bundled. Bundling
keeps it offline + deterministic.

Consequence / open: `web-tree-sitter` becomes KIT's first runtime dependency (made optional —
`optionalDependencies`, code no-ops if absent). Implementation hit two concrete items to resolve
first (KIT-T012 history 2026-06-03): a `web-tree-sitter`/`tree-sitter-wasms` ABI version pin, and
how a *plugin-installed* consumer gets the dep/grammars (vendor the `.wasm` vs document a
one-time `npm install`). Source: HOD session 2026-06-03 questionnaire.
