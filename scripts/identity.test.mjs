#!/usr/bin/env node
// Tests for the human identity resolver + the no-personal-names regression scan (KIT-T145).
// Same hand-rolled harness as comments.test.mjs. exit 0 = all pass.
//
// The regression scan proves NO personal-name literal leaks into the code (ui/src, server,
// scripts, hooks, commands). The forbidden name is NEVER hardcoded here — it is SOURCED from
// config: the resolved user alias (KIT_USER / registry `user`) plus an optional KIT_DENAME_NAMES
// env list. So this test file itself stays name-free, and the denylist tracks whatever alias the
// machine is configured with.

import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUser, DEFAULT_USER } from './identity.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, '..');
let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// ---- resolution chain: env KIT_USER → registry user → 'user' ------------------------------
const savedRegistry = process.env.CLAUDE_KIT_REGISTRY;
const savedUser = process.env.KIT_USER;
try {
  ok('resolve: explicit KIT_USER env wins', resolveUser({ KIT_USER: 'alice' }) === 'alice');

  const regDir = mkdtempSync(join(tmpdir(), 'kit-identity-'));
  fixtures.push(regDir);
  const regFile = join(regDir, 'registry.json');
  writeFileSync(regFile, JSON.stringify({ user: 'bob', projects: {} }));
  process.env.CLAUDE_KIT_REGISTRY = regFile;
  delete process.env.KIT_USER;
  ok('resolve: falls back to registry `user` field', resolveUser({}) === 'bob');
  ok('resolve: env beats registry', resolveUser({ KIT_USER: 'carol' }) === 'carol');

  process.env.CLAUDE_KIT_REGISTRY = join(regDir, 'does-not-exist.json');
  ok('resolve: literal fallback when nothing configured', resolveUser({}) === DEFAULT_USER);
  ok('resolve: fallback is the generic role, not a name', DEFAULT_USER === 'user');
} finally {
  if (savedRegistry === undefined) delete process.env.CLAUDE_KIT_REGISTRY;
  else process.env.CLAUDE_KIT_REGISTRY = savedRegistry;
  if (savedUser === undefined) delete process.env.KIT_USER;
  else process.env.KIT_USER = savedUser;
}

// ---- no-personal-name regression scan -----------------------------------------------------
// Denylist SOURCED from config (never a literal in this file): the resolved alias + KIT_DENAME_NAMES.
// The generic role word 'user' is excluded — it appears legitimately everywhere.
function denylist() {
  const names = new Set();
  const add = (n) => { const t = String(n || '').trim().toLowerCase(); if (t && t !== DEFAULT_USER) names.add(t); };
  add(resolveUser());
  for (const n of String(process.env.KIT_DENAME_NAMES || '').split(',')) add(n);
  return [...names];
}

const SCAN_DIRS = ['ui/src', 'server', 'scripts', 'hooks', 'commands'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);
const SCAN_EXT = /\.(mjs|cjs|js|jsx|ts|tsx|md|css|json|html)$/i;

function* walk(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      yield* walk(full);
    } else if (e.isFile() && SCAN_EXT.test(e.name)) {
      yield full;
    }
  }
}

const names = denylist();
if (!names.length) {
  // No alias configured on this machine (a fresh checkout with no registry `user` / KIT_USER):
  // the scan has nothing to enforce. Report it rather than passing a hollow assertion.
  console.log('  note  no user alias configured (set registry `user` or KIT_USER to enforce the name scan)');
  ok('de-name: scan is a no-op without a configured alias (nothing to enforce)', true);
} else {
  const hits = [];
  for (const rel of SCAN_DIRS) {
    for (const file of walk(join(REPO_ROOT, rel))) {
      let text;
      try {
        if (statSync(file).size > 2_000_000) continue; // skip an oversized/binary blob
        text = readFileSync(file, 'utf8');
      } catch { continue; }
      const lc = text.toLowerCase();
      for (const name of names) {
        if (lc.includes(name)) hits.push(`${file} contains personal-name literal`);
      }
    }
  }
  if (hits.length) hits.slice(0, 20).forEach((h) => console.log('  HIT   ' + h));
  ok(`de-name: no personal-name literal in ${SCAN_DIRS.join(', ')} (denylist from config)`, hits.length === 0);
}

for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best-effort */ } }
console.log(`\nidentity.test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
