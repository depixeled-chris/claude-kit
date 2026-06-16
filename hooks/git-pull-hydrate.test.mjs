#!/usr/bin/env node
// Tests for hooks/git-pull-hydrate.mjs (KIT-T097) — PostToolUse(Bash) hook.
// Spawns the hook with synthetic payloads and asserts exit 0 in every case.
// The hook is fail-open so exit code is always 0; we verify the "did it hydrate"
// signal via stderr content (the hook writes a one-line receipt to stderr when it fires).

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(fileURLToPath(import.meta.url), '..', 'git-pull-hydrate.mjs');
const STORES = ['inbox', 'tickets', 'decisions', 'questions', 'notes'];

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}

// Make a throwaway adopted git repo.
function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-gph-'));
  fixtures.push(dir);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  if (adopt) {
    for (const s of STORES) mkdirSync(join(dir, '.ai', s), { recursive: true });
  }
  return dir;
}

// Spawn the hook with a JSON payload piped to stdin. cwd controls gitRoot().
function run(dir, payload) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  return { code: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// 1. git pull in adopted repo → exit 0, no crash (the key invariant: always exit 0).
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git pull origin main' } });
  ok('git pull adopted: exits 0 (fail-open)', r.code === 0, `code=${r.code} err=${r.stderr}`);
}

// 2. git merge in adopted repo → exit 0.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git merge feature/x' } });
  ok('git merge adopted: exits 0', r.code === 0, `code=${r.code}`);
}

// 3. git checkout in adopted repo → exit 0.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git checkout main' } });
  ok('git checkout adopted: exits 0', r.code === 0, `code=${r.code}`);
}

// 4. git switch in adopted repo → exit 0.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git switch main' } });
  ok('git switch adopted: exits 0', r.code === 0, `code=${r.code}`);
}

// 5. git rebase in adopted repo → exit 0.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git rebase origin/main' } });
  ok('git rebase adopted: exits 0', r.code === 0, `code=${r.code}`);
}

// 6. git commit → exit 0 AND no hydrate (commit doesn't match GIT_PULL_RE).
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git commit -m "implement KIT-T097"' } });
  ok('git commit: exits 0', r.code === 0);
  ok('git commit: no hydrate receipt on stderr', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// 7. git status → exit 0, no hydrate.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git status' } });
  ok('git status: exits 0', r.code === 0);
  ok('git status: no hydrate receipt', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// 8. git push → exit 0, no hydrate.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git push origin main' } });
  ok('git push: exits 0', r.code === 0);
  ok('git push: no hydrate receipt', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// 9. unrelated command (npm install) → exit 0, no hydrate.
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'npm install' } });
  ok('npm install: exits 0', r.code === 0);
  ok('npm install: no hydrate receipt', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// 10. unadopted repo (no .ai/) → exit 0, no hydrate.
{
  const d = makeRepo({ adopt: false });
  const r = run(d, { tool_input: { command: 'git pull origin main' } });
  ok('unadopted repo: exits 0', r.code === 0, `code=${r.code}`);
  ok('unadopted repo: no hydrate receipt', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// 11. malformed / empty payload → exit 0 (fail-open).
{
  const d = makeRepo();
  const r = spawnSync(process.execPath, [HOOK], { cwd: d, input: '', encoding: 'utf8' });
  ok('empty payload: exits 0 (fail-open)', r.status === 0, `code=${r.status}`);
}

// 12. git log (read-only) → exit 0, no hydrate (not in the match set).
{
  const d = makeRepo();
  const r = run(d, { tool_input: { command: 'git log --oneline -5' } });
  ok('git log: exits 0', r.code === 0);
  ok('git log: no hydrate receipt', !r.stderr.includes('git-pull-hydrate'), r.stderr);
}

// Cleanup.
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\ngit-pull-hydrate: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
