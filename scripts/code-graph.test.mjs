#!/usr/bin/env node
// Tests for code-graph.mjs — language-agnostic extraction + queries. Builds a throwaway
// multi-language fixture repo and asserts. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGraph, importersOf, defines, surface } from './code-graph.mjs';

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

const g = buildGraph(root);

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

// Determinism: same repo → identical graph.
const g2 = buildGraph(root);
ok('graph is deterministic', JSON.stringify(g) === JSON.stringify(g2));

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\ncode-graph: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
