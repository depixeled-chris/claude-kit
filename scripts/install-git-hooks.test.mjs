#!/usr/bin/env node
// Tests for scripts/install-git-hooks.mjs (KIT-T097).
// Three cases: clean repo → sets core.hooksPath; re-run → "already installed" no-op;
// repo with pre-existing different hooksPath → WARN+SKIP.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const INSTALLER = resolve(fileURLToPath(import.meta.url), '..', 'install-git-hooks.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// Throw-away git repo in a temp dir.
function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'kit-ghk-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  return dir;
}

function gitConfig(repo, key) {
  const r = spawnSync('git', ['-C', repo, 'config', '--local', key], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

function runInstaller(repoPath) {
  return spawnSync(process.execPath, [INSTALLER, repoPath], { encoding: 'utf8' });
}

// Case 1: clean repo → sets core.hooksPath to the plugin's .githooks dir.
{
  const repo = makeRepo();
  const r = runInstaller(repo);
  const got = gitConfig(repo, 'core.hooksPath');
  ok('clean repo: installer exits 0', r.status === 0, r.stderr);
  ok('clean repo: core.hooksPath set', got.length > 0, `got: "${got}"`);
  ok('clean repo: hooksPath ends with .githooks', got.replace(/\\/g, '/').endsWith('.githooks'), `got: "${got}"`);
}

// Case 2: re-run on already-installed repo → "already installed", exits 0, no-op.
{
  const repo = makeRepo();
  runInstaller(repo); // first install
  const after1 = gitConfig(repo, 'core.hooksPath');
  const r2 = runInstaller(repo); // second install
  const after2 = gitConfig(repo, 'core.hooksPath');
  ok('idempotent: second run exits 0', r2.status === 0, r2.stderr);
  ok('idempotent: core.hooksPath unchanged', after1 === after2, `before="${after1}" after="${after2}"`);
  ok('idempotent: output says already installed', r2.stdout.includes('already installed'));
}

// Case 3: repo with a DIFFERENT pre-existing core.hooksPath → WARN+SKIP (core.hooksPath unchanged).
{
  const repo = makeRepo();
  const otherhooks = '/some/other/hooks';
  execFileSync('git', ['-C', repo, 'config', 'core.hooksPath', otherhooks]);
  const r = runInstaller(repo);
  const got = gitConfig(repo, 'core.hooksPath');
  // Should exit 1 (skip) and leave the path alone.
  ok('pre-existing hooksPath: installer exits 1 (skip)', r.status === 1, r.stderr);
  ok('pre-existing hooksPath: original hooksPath unchanged', got === otherhooks, `got: "${got}"`);
  ok('pre-existing hooksPath: stderr has WARN', r.stderr.includes('WARN'), r.stderr);
}

// Case 4: repo with non-sample .git/hooks files → WARN+SKIP.
{
  const repo = makeRepo();
  // Write a fake hook file (simulating husky).
  mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
  writeFileSync(join(repo, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho husky\n');
  const r = runInstaller(repo);
  const got = gitConfig(repo, 'core.hooksPath');
  ok('non-sample git/hooks: installer exits 1 (skip)', r.status === 1, r.stderr);
  ok('non-sample git/hooks: core.hooksPath not set', got === '', `got: "${got}"`);
  ok('non-sample git/hooks: stderr has WARN', r.stderr.includes('WARN'), r.stderr);
}

// Case 5: post-merge dry-run — executing .githooks/post-merge in a temp repo doesn't error
// even with no SQLite engine (fail-open). Just verify it exits 0.
{
  const repo = makeRepo();
  const kitRoot = resolve(fileURLToPath(import.meta.url), '..', '..');
  const hookPath = join(kitRoot, '.githooks', 'post-merge');
  // post-merge is a sh script; on Windows git ships sh via git-cmd / bash
  const sh = process.platform === 'win32' ? 'sh' : '/bin/sh';
  const r = spawnSync(sh, [hookPath], { cwd: repo, encoding: 'utf8' });
  ok('post-merge dry-run: exits 0 (fail-open)', r.status === 0 || r.status === null,
    `status=${r.status} stderr=${r.stderr}`);
}

// Cleanup.
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\ninstall-git-hooks: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
