#!/usr/bin/env node
// sync-data tests (KIT-T053) — a bare remote, two clones ("machines"), and a project
// whose .ai is a junction into clone A's store. Asserts the hook's receipts are TRUTHFUL:
// success says pushed, a rejected push rebases + retries, a conflicted divergence fails
// LOUDLY while keeping the local commit. exit 0 = all pass.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = join(dirname(fileURLToPath(import.meta.url)), 'sync-data.mjs');
let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (detail ? `  (${detail})` : '')); }
}
function sh(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function clone(bare, name, base) {
  const d = join(base, name);
  sh(['clone', '-q', bare, d], base);
  sh(['config', 'user.email', 'test@test'], d);
  sh(['config', 'user.name', 'test'], d);
  return d;
}
function runHook(projDir) {
  const r = spawnSync(process.execPath, [HOOK], { input: '{}', cwd: projDir, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
// A fresh world: bare remote, clone A (this machine's data repo), and a project repo
// whose .ai is a junction/symlink to A's store dir. Returns the pieces.
function world(base) {
  const bare = join(base, 'remote.git');
  mkdirSync(bare);
  sh(['init', '-q', '--bare', bare], base);
  const a = clone(bare, 'dataA', base);
  mkdirSync(join(a, 'projX', 'tickets'), { recursive: true });
  writeFileSync(join(a, 'projX', 'tickets', 'X-T001-seed.md'), '---\nid: X-T001\ntitle: seed\nstatus: todo\n---\n');
  sh(['add', '-A'], a);
  sh(['commit', '-q', '-m', 'seed'], a);
  sh(['push', '-q', '-u', 'origin', 'HEAD'], a);
  const proj = join(base, 'proj');
  mkdirSync(proj);
  sh(['init', '-q', proj], base);
  symlinkSync(join(a, 'projX'), join(proj, '.ai'), 'junction');
  return { bare, a, proj };
}
const remoteHead = (bare) => sh(['rev-parse', 'HEAD'], bare).trim();

try {
  const base = mkdtempSync(join(tmpdir(), 'kit-sync-'));
  fixtures.push(base);

  // 1. clean data repo -> silent no-op
  {
    mkdirSync(join(base, 'w1'));
    const w = world(join(base, 'w1'));
    const r = runHook(w.proj);
    ok('clean data repo is a silent no-op', r.code === 0 && r.out.trim() === '', r.out.trim());
  }

  // 2. happy path: change -> committed + pushed, remote advances
  {
    mkdirSync(join(base, 'w2'));
    const w = world(join(base, 'w2'));
    const before = remoteHead(w.bare);
    writeFileSync(join(w.a, 'projX', 'tickets', 'X-T001-seed.md'), '---\nid: X-T001\ntitle: seed\nstatus: doing\n---\n');
    const r = runHook(w.proj);
    ok('happy path receipt says committed + pushed', r.code === 0 && r.out.includes('committed + pushed'), r.out.trim());
    ok('happy path actually advanced the remote', remoteHead(w.bare) !== before);
  }

  // 3. rejected push (remote moved, DIFFERENT file) -> rebase + retry succeeds
  {
    mkdirSync(join(base, 'w3'));
    const w = world(join(base, 'w3'));
    const b = clone(w.bare, 'dataB', join(base, 'w3'));
    writeFileSync(join(b, 'other.md'), 'machine B was here\n');
    sh(['add', '-A'], b);
    sh(['commit', '-q', '-m', 'B'], b);
    sh(['push', '-q'], b);
    writeFileSync(join(w.a, 'projX', 'tickets', 'X-T001-seed.md'), '---\nid: X-T001\ntitle: seed\nstatus: review\n---\n');
    const r = runHook(w.proj);
    ok('rejected push rebases and still reports pushed', r.code === 0 && r.out.includes('committed + pushed'), r.out.trim());
    const log = sh(['log', '--oneline'], w.bare);
    ok('remote holds BOTH machines\' commits after rebase', log.includes('B') && log.includes('sync: workflow data'));
  }

  // 4. true divergence (SAME file, conflicting content) -> loud failure, local commit kept, no mid-rebase state
  {
    mkdirSync(join(base, 'w4'));
    const w = world(join(base, 'w4'));
    const b = clone(w.bare, 'dataB', join(base, 'w4'));
    writeFileSync(join(b, 'projX', 'tickets', 'X-T001-seed.md'), '---\nid: X-T001\ntitle: seed\nstatus: done\n---\n');
    sh(['add', '-A'], b);
    sh(['commit', '-q', '-m', 'B-conflict'], b);
    sh(['push', '-q'], b);
    writeFileSync(join(w.a, 'projX', 'tickets', 'X-T001-seed.md'), '---\nid: X-T001\ntitle: seed\nstatus: doing\n---\n');
    const r = runHook(w.proj);
    ok('conflicted divergence reports PUSH FAILED (no false receipt)', r.code === 0 && r.out.includes('PUSH FAILED'), r.out.trim());
    ok('local commit is kept', sh(['log', '--oneline'], w.a).includes('sync: workflow data'));
    ok('repo is not left mid-rebase', sh(['status'], w.a).includes('working tree clean') || !sh(['status'], w.a).includes('rebase'));
  }
} finally {
  for (const f of fixtures) { try { rmSync(f, { recursive: true, force: true }); } catch { /* best-effort */ } }
}

console.log(fail === 0 ? `\nall pass (${pass})` : `\n${fail} FAILED, ${pass} passed`);
process.exit(fail === 0 ? 0 : 1);
