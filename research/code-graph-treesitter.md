# Code graph — tree-sitter accuracy upgrade

**Question:** How to upgrade the dependency-free heuristic code graph (KIT-T012, shipped) to
precise, any-language definition/reference edges via tree-sitter — and what does "any
language" actually require?
**Date:** 2026-06-03 · **Status:** 🔬 ready (informs KIT-T012); implementation gated on the grammar-strategy decision

## TL;DR
The shipped code graph extracts imports + symbols with line-based heuristics (zero deps, any
text file). tree-sitter upgrades that to a real parse tree with **`tags.scm` queries** — the
standard "code navigation" mechanism (jump-to-def / find-refs; the same thing aider's repo-map
uses). Tags use `@definition.<kind>` / `@reference.<kind>` captures + an `@name` capture, and
**each language ships its own `tags.scm` + grammar**. So "any language" via tree-sitter is real,
but it costs **per language**: a grammar `.wasm` + a `tags.scm`. Two things to decide before
building: (1) accept `web-tree-sitter` as **KIT's first runtime dependency** (the hooks are
proudly dep-free today); (2) the **grammar-management strategy** (bundle a curated set / fetch on
demand / require the tree-sitter CLI). Recommend: keep the heuristic as the always-on fallback,
add tree-sitter as an **optional accuracy layer** (cascade — exactly KIT-T004's engine pattern),
and **bundle a curated core grammar set** with drop-in support for more.

## Current state
- `scripts/code-graph.mjs`: line-based per-family patterns + a generic fallback → files, symbols
  (def kind + line), import edges (with an `external` flag). Zero deps. Git-aware file list.
  Queries: `importers-of`, `defines`, `surface`. Maintained by a Stop hook into a machine-local
  cache. Good enough for "who imports X / where is symbol Y / public surface of M".
- Limits (what tree-sitter fixes): no real **reference/call** edges (only imports); heuristic
  symbol extraction misses/over-matches in edge cases (multiline sigs, macros, unusual syntax);
  kind classification is coarse.

## What tree-sitter needs ("any language" reality)
- `web-tree-sitter` (WASM bindings): `const L = await Parser.Language.load('tree-sitter-X.wasm');
  parser.setLanguage(L); parser.parse(src)`, then run a `Query` (S-expression) over the tree.
  WASM is slower than native bindings but portable (no native build) — fine for a per-turn,
  staleness-gated rebuild.
- **Per language**: a grammar `.wasm` + that language's `queries/tags.scm`. Available for ~all
  mainstream languages (js/ts/py/rs/go/java/c/cpp/rb/php/c#/…). This is the real cost of "any
  language" — it's per-grammar data, not one universal parser.

## Decisions (surface via /decide questionnaire)
1. **First runtime dependency.** Accept `web-tree-sitter` (+ grammar assets) as KIT's first
   runtime dep? Today the hooks pride themselves on zero deps. *(Maintainer leaned yes in the
   HOD-session questionnaire — confirm with the WASM-slower + asset-size tradeoff in view.)*
2. **Grammar-management strategy** (the real fork):
   - **A — bundle a curated core set** (recommended): ship `.wasm` + `tags.scm` for ~8–12 common
     languages in the plugin; drop-in a grammar to add more. Offline, deterministic, but adds
     a few MB to the plugin.
   - **B — fetch on demand**: download grammars to the machine-local cache on first use. Tiny
     repo, but a network dependency + non-determinism.
   - **C — require the tree-sitter CLI**: user generates grammars locally. No bundled assets,
     but a heavy setup burden — contradicts "works anywhere".

## Recommendation
**Cascade, don't replace.** Keep the heuristic extractor as the always-available baseline
(zero-dep, any text); add tree-sitter as an **optional precision layer** that, when present,
supplies real def/ref edges for bundled languages and falls back to the heuristic otherwise —
mirroring KIT-T004's "prefer better-sqlite3 → node:sqlite → markdown scan". Grammar strategy **A**
(bundle a curated core set + drop-in). This preserves "runs anywhere with zero deps" as the
floor while making accuracy opt-in.

## Phased, test-gated plan (after the decisions)
1. Add `web-tree-sitter` as an **optional** dep; a loader that no-ops (→ heuristic) if it or a
   grammar is absent. Gate: existing 15 code-graph tests still pass with tree-sitter absent.
2. Bundle the curated grammar set + `tags.scm`; wire def/ref extraction behind the cascade.
   Gate: parse a multi-language fixture; assert real reference edges the heuristic missed.
3. Add a `references-of <symbol>` query (now that reference edges exist). Gate: fixture test.
4. Measure rebuild time (WASM parse) on a mid-size repo; keep the Stop hook staleness-gated so
   the cost is paid only on change.

## Open-core classification
claude-kit tooling (MIT, public). No HOD/product entanglement. The bundled grammars carry their
own (typically MIT/Apache) licenses — vendor with attribution.

## Sources
- [Tree-sitter — Code Navigation (tags.scm: @definition/@reference/@name)](https://tree-sitter.github.io/tree-sitter/4-code-navigation.html)
- [web-tree-sitter — npm](https://www.npmjs.com/package/web-tree-sitter)
- [tree-sitter binding_web README (Language.load, Query API)](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md)
- [tree-sitter discussion #1251 — files in a grammar's queries/ dir](https://github.com/tree-sitter/tree-sitter/discussions/1251)
