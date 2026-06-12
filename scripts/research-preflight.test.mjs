#!/usr/bin/env node
// Tests for research-preflight.mjs (KIT-T047).
// Uses a throwaway temp repo so the full file-scan + match path is exercised.
// exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const PREFLIGHT = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

// Run the preflight CLI in a given repo root. Returns { stdout, stderr, status }.
function preflight(repoRoot, topicArgs) {
  const result = spawnSync(
    process.execPath,
    [PREFLIGHT, '--root', repoRoot, ...topicArgs],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 0 };
}

// Create a minimal git-init'd temp repo and return its root path.
function makeGitRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-preflight-'));
  fixtures.push(root);
  // git init so the script can find the repo root via git rev-parse.
  execFileSync('git', ['init', root], { stdio: 'ignore' });
  return root;
}

// ---------------------------------------------------------------------------
// 1. Matching topic: "buildings" / "enterable" surfaces the canonical doc
// ---------------------------------------------------------------------------
console.log('\n1. Matching topic surfaces the canonical doc');
{
  const root = makeGitRepo();
  mkdirSync(join(root, 'docs', 'research'), { recursive: true });
  // WHY this content: mirrors the actual HOD doc that triggered KIT-T047.
  writeFileSync(join(root, 'docs', 'research', 'enterable-buildings.md'), [
    '---',
    'title: Enterable Buildings Design',
    'description: Design doc for enterable buildings in HOD',
    '---',
    '',
    '# Enterable Buildings',
    '',
    'Canonical design document for player-enterable buildings.',
  ].join('\n'));

  const r1 = preflight(root, ['buildings']);
  ok('"buildings" exits 0', r1.status === 0);
  ok('"buildings" output contains the file path', r1.stdout.includes('enterable-buildings.md'));

  const r2 = preflight(root, ['enterable']);
  ok('"enterable" exits 0', r2.status === 0);
  ok('"enterable" output contains the file path', r2.stdout.includes('enterable-buildings.md'));

  // Both terms together should still hit it.
  const r3 = preflight(root, ['enterable', 'buildings']);
  ok('"enterable buildings" exits 0', r3.status === 0);
  ok('"enterable buildings" output contains the file path', r3.stdout.includes('enterable-buildings.md'));

  // The "EXTEND" instruction must appear in the output.
  ok('"buildings" output mentions EXTEND', r1.stdout.toLowerCase().includes('extend'));
}

// ---------------------------------------------------------------------------
// 2. Novel topic: no false positive for an unrelated topic
// ---------------------------------------------------------------------------
console.log('\n2. Novel topic — no false candidate, no-prior-art line printed');
{
  const root = makeGitRepo();
  mkdirSync(join(root, 'docs', 'research'), { recursive: true });
  writeFileSync(join(root, 'docs', 'research', 'enterable-buildings.md'), [
    '# Enterable Buildings',
    '',
    'Canonical design document for player-enterable buildings.',
  ].join('\n'));

  const r = preflight(root, ['spaceship', 'combat']);
  ok('"spaceship combat" exits 0', r.status === 0);
  ok('"spaceship combat" does not mention enterable-buildings.md', !r.stdout.includes('enterable-buildings.md'));
  ok('"spaceship combat" prints no-prior-art line', r.stdout.includes('no prior art'));
}

// ---------------------------------------------------------------------------
// 3. Fail-open: repo with no docs/research/ doesn't throw
// ---------------------------------------------------------------------------
console.log('\n3. Fail-open — repo with no docs/research/ directory');
{
  const root = makeGitRepo();
  // Intentionally no docs/research/ directory.

  const r = preflight(root, ['buildings']);
  ok('exits 0 with no docs/research/', r.status === 0);
  ok('prints no-prior-art line', r.stdout.includes('no prior art'));
}

// ---------------------------------------------------------------------------
// Teardown
// ---------------------------------------------------------------------------
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
