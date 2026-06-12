#!/usr/bin/env node
// Tests for init-project.mjs — key derivation, config seeding, idempotency, --key override.
// Builds throwaway fixtures in a temp dir and asserts. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { deriveKey } from './init-project.mjs';

const SCRIPT = resolve(fileURLToPath(import.meta.url), '..', 'init-project.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

// ---- Key derivation (pure function, no filesystem) ----------------------------

ok('hustle-or-die → HOD (multi-word hyphen)',   deriveKey('hustle-or-die') === 'HOD');
ok('my_cool_project → MCP (underscores)',        deriveKey('my_cool_project') === 'MCP');
ok('foo bar baz → FBB (spaces)',                 deriveKey('foo bar baz') === 'FBB');
ok('marblerace2 → MAR (single word, 3 letters)', deriveKey('marblerace2') === 'MAR');
ok('ab → AB (short single word)',                deriveKey('ab') === 'AB');
ok('x → X (single letter)',                      deriveKey('x') === 'X');
ok('  → PRJ (empty after strip)',                deriveKey('') === 'PRJ');
ok('---  → PRJ (all separators)',                deriveKey('---') === 'PRJ');
ok('claude-kit → CK (two words)',               deriveKey('claude-kit') === 'CK');
ok('prefix is uppercased',                       deriveKey('hello-world') === 'HW');

// ---- Fresh init into a temp dir -----------------------------------------------

// Minimal project-template .ai scaffold to exercise seedProjectKey.
function makeProjectDir(name) {
  const base = mkdtempSync(join(tmpdir(), 'kit-init-'));
  fixtures.push(base);
  // The project dir is a subdirectory named `name` so basename(target) == name.
  const projectDir = join(base, name);
  mkdirSync(projectDir, { recursive: true });
  return projectDir;
}

function readConfig(projectDir) {
  return readFileSync(join(projectDir, '.ai', 'config.yml'), 'utf8');
}

// Run init-project.mjs against a target dir (no CLAUDE_DATA → local mode).
function runInit(projectDir, extraArgs = []) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, projectDir, ...extraArgs],
    { encoding: 'utf8' },
  );
  return result;
}

// --- fresh init: key derived from directory name ---
const freshDir = makeProjectDir('hustle-or-die');
const r1 = runInit(freshDir);
ok('fresh init exits 0', r1.status === 0);

const cfg1 = readConfig(freshDir);
ok('fresh init: ids.key = HOD', /key:\s*"HOD"/.test(cfg1));
ok('fresh init: ids.prefix = HOD-T', /prefix:\s*"HOD-T"/.test(cfg1));

// Verify a fresh ticket would get HOD-T001 shape (key present, no existing tickets).
// We don't need to call nextId; the config write is the direct invariant for AC-4.
ok('fresh init: KEY placeholder replaced (not present)', !cfg1.includes('"KEY"'));

// --- idempotency: re-running against a config whose key is already set ------------
const r2 = runInit(freshDir);
ok('idempotent re-run exits 0', r2.status === 0);
const cfg2 = readConfig(freshDir);
ok('idempotent: key unchanged after second run', /key:\s*"HOD"/.test(cfg2));

// --- idempotency: pre-seeded key must NOT be clobbered ---
const preKeyDir = makeProjectDir('something-else');
// Scaffold .ai manually with a real (non-placeholder) key already set.
mkdirSync(join(preKeyDir, '.ai', 'tickets'), { recursive: true });
writeFileSync(
  join(preKeyDir, '.ai', 'config.yml'),
  'ids:\n  key: "HOD"\n  prefix: "HOD-T"\n  pad: 3\n',
);
const r3 = runInit(preKeyDir);
ok('pre-seeded key: init exits 0', r3.status === 0);
const cfg3 = readConfig(preKeyDir);
ok('pre-seeded key: HOD preserved (not replaced by SE)', /key:\s*"HOD"/.test(cfg3));

// --- --key override beats derivation ---
const overrideDir = makeProjectDir('hustle-or-die');
const r4 = runInit(overrideDir, ['--key=XYZ']);
ok('--key override: exits 0', r4.status === 0);
const cfg4 = readConfig(overrideDir);
ok('--key override: ids.key = XYZ', /key:\s*"XYZ"/.test(cfg4));
ok('--key override: ids.prefix = XYZ-T', /prefix:\s*"XYZ-T"/.test(cfg4));

// --- cleanup ---
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch {}
}

console.log(`\ninit-project: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
