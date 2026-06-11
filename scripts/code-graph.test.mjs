#!/usr/bin/env node
// Tests for code-graph.mjs — language-agnostic extraction + queries. Builds a throwaway
// multi-language fixture repo and asserts. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGraph, importersOf, defines, surface, referencesOf, codemapCheck, duplicateDefines, entryPoints } from './code-graph.mjs';

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// A 3-language fixture: a TS module importing a sibling, plus Python and Rust files.
const root = mkdtempSync(join(tmpdir(), 'kit-cg-'));
fixtures.push(root);
mkdirSync(join(root, 'src'), { recursive: true });
writeFileSync(join(root, 'src', 'util.ts'), 'export function helper() {}\nexport class Widget {}\n');
writeFileSync(join(root, 'src', 'main.ts'), "import { helper } from './util';\nexport const run = () => helper();\n");
writeFileSync(join(root, 'app.py'), 'import os\nfrom sys import argv\ndef boot():\n    pass\nclass Server:\n    pass\n');
writeFileSync(join(root, 'lib.rs'), 'use std::fmt;\npub fn compute() {}\npub struct Engine {}\n');
// An unknown extension still gets the generic fallback.
writeFileSync(join(root, 'thing.zig'), 'fn doThing() void {}\n');

const g = await buildGraph(root);

ok('walks all source files across languages', g.files.length === 5);
ok('detects language per family', g.files.find((f) => f.path === 'app.py')?.lang === 'python');

// Symbols extracted per language.
ok('TS symbols extracted', surface(g, 'src/util.ts').some((s) => s.name === 'helper' && s.kind === 'function')
  && surface(g, 'src/util.ts').some((s) => s.name === 'Widget' && s.kind === 'class'));
ok('Python symbols extracted', defines(g, 'boot').includes('app.py') && defines(g, 'Server').includes('app.py'));
ok('Rust symbols extracted', defines(g, 'compute').includes('lib.rs') && defines(g, 'Engine').includes('lib.rs'));
ok('unknown language gets generic fallback', defines(g, 'doThing').includes('thing.zig'));

// Edges: a relative import resolves to a repo file; importers-of works.
ok('relative import resolves to the sibling file', importersOf(g, 'src/util.ts').includes('src/main.ts'));
const utilEdge = g.edges.find((e) => e.from === 'src/main.ts' && e.to === 'src/util.ts');
ok('resolved edge is not marked external', utilEdge && utilEdge.external === false);
const extEdge = g.edges.find((e) => e.from === 'app.py' && e.to === 'os');
ok('bare import stays an external node', extEdge && extEdge.external === true);

// Precision cascade: when web-tree-sitter is available, supported languages get precise
// symbols + reference (call) edges; otherwise the heuristic floor (no refs). Guarded so the
// suite passes either way (the floor is always correct).
if (g.precise) {
  ok('precise: tree-sitter reference edge (helper called in main.ts)', referencesOf(g, 'helper').includes('src/main.ts'));
  ok('precise: TS definition kinds correct', surface(g, 'src/util.ts').some((s) => s.name === 'Widget' && s.kind === 'class'));
  ok('precise: Rust struct is a type def', surface(g, 'lib.rs').some((s) => s.name === 'Engine' && s.kind === 'type'));
} else {
  ok('precision layer skipped (web-tree-sitter absent) — heuristic floor holds', referencesOf(g, 'helper').length === 0);
}

// Determinism: same repo → identical graph.
const g2 = await buildGraph(root);
ok('graph is deterministic', JSON.stringify(g) === JSON.stringify(g2));

// codemap drift check: flags code files missing from CODEMAP + CODEMAP entries with no
// matching code. `src/util.ts` is documented by the `src/` dir prefix; `src/main.ts` and
// `app.py`/`lib.rs`/`thing.zig` are undocumented; `gone/old.ts` is stale.
const codemapText = '| `src/` | the source dir | |\n| `gone/old.ts` | removed module | |\n';
const cmc = codemapCheck(g, codemapText);
ok('codemap-check: dir-prefix documents files under it', !cmc.undocumented.includes('src/util.ts') && !cmc.undocumented.includes('src/main.ts'));
ok('codemap-check: undocumented files flagged', cmc.undocumented.includes('app.py') && cmc.undocumented.includes('lib.rs'));
ok('codemap-check: stale entry flagged', cmc.stale.includes('gone/old.ts'));

// git-aware: in a git repo, .gitignored files are excluded (the submodule/.gitignore
// awareness). Falls back to a raw walk in a non-git dir (covered by the cases above).
try {
  const grepo = mkdtempSync(join(tmpdir(), 'kit-cg-git-'));
  fixtures.push(grepo);
  const g0 = { cwd: grepo, stdio: 'ignore' };
  execFileSync('git', ['init', '-q'], g0);
  writeFileSync(join(grepo, 'kept.ts'), 'export function kept() {}\n');
  writeFileSync(join(grepo, 'ignored.ts'), 'export function ignoredSym() {}\n');
  writeFileSync(join(grepo, '.gitignore'), 'ignored.ts\n');
  const gg = await buildGraph(grepo);
  ok('git-aware: tracked file included', defines(gg, 'kept').includes('kept.ts'));
  ok('git-aware: .gitignored file excluded', !gg.files.some((f) => f.path === 'ignored.ts'));
} catch {
  ok('git-aware test skipped (git unavailable)', true);
}

// duplicate-defines (KIT-T079) — a factory `createRoadEditor` defined in TWO editors. The
// canonical one (`rapid/editor.ts`) is imported by shipped app code OUTSIDE its subtree; the
// superseded twin (`tools/editor.ts`) is reached only from its own `tools/` closure. The query
// must surface BOTH and flag exactly the dead one — the signal the lived failure lacked.
const dup = mkdtempSync(join(tmpdir(), 'kit-cg-dup-'));
fixtures.push(dup);
mkdirSync(join(dup, 'src'), { recursive: true });
mkdirSync(join(dup, 'rapid'), { recursive: true });
mkdirSync(join(dup, 'tools'), { recursive: true });
// Canonical: defined in rapid/, imported by the shipped app entry in src/ (a cross-subtree edge).
writeFileSync(join(dup, 'rapid', 'editor.ts'), 'export function createRoadEditor() {}\n');
writeFileSync(join(dup, 'src', 'main.ts'), "import { createRoadEditor } from '../rapid/editor';\ncreateRoadEditor();\n");
// Superseded: a same-named twin in tools/, reached ONLY from its own tools/ subtree.
writeFileSync(join(dup, 'tools', 'editor.ts'), 'export function createRoadEditor() {}\n');
writeFileSync(join(dup, 'tools', 'preview.ts'), "import { createRoadEditor } from './editor';\ncreateRoadEditor();\n");

const dg = await buildGraph(dup);
const dd = duplicateDefines(dg, 'createRoadEditor');
ok('duplicate-defines: finds BOTH twin definitions', dd.length === 2
  && dd.some((r) => r.path === 'rapid/editor.ts') && dd.some((r) => r.path === 'tools/editor.ts'));
const deadTwin = dd.find((r) => r.path === 'tools/editor.ts');
const liveTwin = dd.find((r) => r.path === 'rapid/editor.ts');
ok('duplicate-defines: flags the self-contained twin as superseded', deadTwin && deadTwin.superseded === true);
ok('duplicate-defines: the cross-subtree-imported twin is canonical (not superseded)', liveTwin && liveTwin.superseded === false);
ok('duplicate-defines: superseded twin reports no external importers', deadTwin && deadTwin.externalImporters.length === 0);
ok('duplicate-defines: an unknown symbol yields nothing', duplicateDefines(dg, 'somethingUnique').length === 0);
// Fail-open: a symbol defined in exactly one file is not a "duplicate" → empty.
writeFileSync(join(dup, 'src', 'solo.ts'), 'export function onlyHere() {}\n');
const dg2 = await buildGraph(dup);
ok('duplicate-defines: single definition is not a duplicate', duplicateDefines(dg2, 'onlyHere').length === 0);
// Conservative: when NEITHER twin is reached from outside its subtree, flag neither (can't tell).
const iso = mkdtempSync(join(tmpdir(), 'kit-cg-iso-'));
fixtures.push(iso);
mkdirSync(join(iso, 'a'), { recursive: true });
mkdirSync(join(iso, 'b'), { recursive: true });
writeFileSync(join(iso, 'a', 'f.ts'), 'export function twin() {}\n');
writeFileSync(join(iso, 'b', 'f.ts'), 'export function twin() {}\n');
const ig = await buildGraph(iso);
const idd = duplicateDefines(ig, 'twin');
ok('duplicate-defines: both twins found even with no importers', idd.length === 2);
ok('duplicate-defines: flags neither when no twin is externally imported (can\'t-tell, not dead)', idd.every((r) => r.superseded === false));

// entry-points (KIT-T079) — two index.html + two main.ts in two subtrees = the multi-root smell.
const eg = entryPoints(dup);
ok('entry-points: finds the app entry main.ts files', eg.entries.includes('src/main.ts'));
const epRoot = mkdtempSync(join(tmpdir(), 'kit-cg-ep-'));
fixtures.push(epRoot);
mkdirSync(join(epRoot, 'app'), { recursive: true });
mkdirSync(join(epRoot, 'editor'), { recursive: true });
writeFileSync(join(epRoot, 'app', 'index.html'), '<!doctype html><div id=root></div>\n');
writeFileSync(join(epRoot, 'app', 'main.tsx'), 'export const app = 1;\n');
writeFileSync(join(epRoot, 'editor', 'index.html'), '<!doctype html><div id=root></div>\n');
writeFileSync(join(epRoot, 'editor', 'main.tsx'), 'export const ed = 1;\n');
writeFileSync(join(epRoot, 'vite.config.ts'), 'export default {};\n');
const ep = entryPoints(epRoot);
ok('entry-points: enumerates index.html roots', ep.entries.includes('app/index.html') && ep.entries.includes('editor/index.html'));
ok('entry-points: enumerates main.tsx roots', ep.entries.includes('app/main.tsx') && ep.entries.includes('editor/main.tsx'));
ok('entry-points: a vite config counts as a root', ep.entries.includes('vite.config.ts'));
ok('entry-points: multi-root flagged when roots span subtrees', ep.multiRoot === true);
ok('entry-points: roots grouped by subtree', Array.isArray(ep.byTree.app) && Array.isArray(ep.byTree.editor));
// Fail-open: a bogus root yields a well-formed empty result, never a throw.
const epEmpty = entryPoints(join(tmpdir(), 'kit-cg-does-not-exist-' + Date.now()));
ok('entry-points: missing root → well-formed empty result', epEmpty.entries.length === 0 && epEmpty.multiRoot === false);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\ncode-graph: ${pass} passed, ${fail} failed`);
// Set exitCode and let the loop drain naturally — calling process.exit() while the
// web-tree-sitter WASM runtime is still closing aborts the process on Windows.
process.exitCode = fail ? 1 : 0;
