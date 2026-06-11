// Tests for KIT-T016 — ENFORCE the harness-memory ⇄ committed-memory unification (KIT-D016 +
// KIT-D002) instead of trusting a one-time manual link. Three concerns, all over throwaway repos
// with an ISOLATED harness home (CLAUDE_HOME) + registry (CLAUDE_KIT_REGISTRY) so nothing touches
// the real ~/.claude:
//   1. lib semantics — memoryUnification classifies {no-repo-memory, unified, absent, diverged};
//      unifyMemory links the absent case, is idempotent, and NEVER clobbers a divergence.
//   2. orient.mjs (SessionStart) — the THREE acceptance branches: link-present (silent / already
//      unified), link-absent (auto-creates + heals, ZERO silent machine-local loss), diverged
//      (loud warning + exact fix command, copy untouched).
//   3. bootstrap.mjs (adoption) — unifies every project the registry knows, idempotently +
//      cross-platform; reports (never clobbers) a divergence; DRY_RUN changes nothing.
// The link is a junction on Windows / symlink on POSIX — both resolve via realpath, so "unified"
// is asserted by realpath equality, not by link kind.
// Run: node hooks/memory-link.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { gitRoot } from './lib.mjs';
import { repoMemoryDir, harnessMemoryDir, memoryUnification, unifyMemory, memoryLinkCommand } from './memory-link.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ORIENT = join(HERE, 'orient.mjs');
const BOOTSTRAP = join(ROOT, 'bootstrap.mjs');
const fixtures = [];
let pass = 0;
let fail = 0;

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// A throwaway HOME so harnessMemoryDir resolves under it (CLAUDE_HOME overrides ~/.claude). Each
// test gets its own so parallel encoded-path dirs never collide.
function freshHome() {
  const h = mkdtempSync(join(tmpdir(), 'kit-ml-home-'));
  fixtures.push(h);
  return h;
}

// The harness memory dir for a project under an EXPLICIT throwaway home. harnessMemoryDir reads
// CLAUDE_HOME at call time and the test PARENT never sets it (only spawned children do), so wire
// the home in around the call rather than reach for the real ~/.claude. `projRoot` is already the
// gitRoot-normalized string repo() returns, so the encoded path matches what the subprocess derives.
function harnessUnder(home, projRoot) {
  const prev = process.env.CLAUDE_HOME;
  process.env.CLAUDE_HOME = home;
  try { return harnessMemoryDir(projRoot); } finally {
    if (prev === undefined) delete process.env.CLAUDE_HOME; else process.env.CLAUDE_HOME = prev;
  }
}

// A throwaway adopted repo. `withMemory` seeds the committed .claude/memory (the link TARGET) with
// a MEMORY.md so unification has something real to point at. Returns the gitRoot-NORMALIZED root
// (forward slashes, long name) — the exact string orient/bootstrap compute via gitRoot(), so every
// path the test derives matches the dir the production code actually touches (temp dirs are 8.3
// short-named; a real project path isn't, so this only bites under test).
function repo({ withMemory = true } = {}) {
  const raw = mkdtempSync(join(tmpdir(), 'kit-ml-'));
  fixtures.push(raw);
  execFileSync('git', ['init', '-q'], { cwd: raw, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: raw, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: raw, stdio: 'ignore' });
  mkdirSync(join(raw, '.ai'), { recursive: true }); // adopted
  if (withMemory) {
    mkdirSync(join(raw, '.claude', 'memory'), { recursive: true });
    writeFileSync(join(raw, '.claude', 'memory', 'MEMORY.md'), '# committed memory (source of truth)\n');
  }
  return gitRoot(raw) || raw;
}

// Seed the harness side (under the throwaway home) as a REAL (non-link) dir holding its own
// memory — the divergent-machine case the enforcement must catch, not silently overwrite.
function seedHarnessRealCopy(home, projRoot, body) {
  const hd = harnessUnder(home, projRoot);
  mkdirSync(hd, { recursive: true });
  writeFileSync(join(hd, 'MEMORY.md'), body);
  return hd;
}

function orient(projRoot, home) {
  const r = spawnSync(process.execPath, [ORIENT], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }), cwd: projRoot, encoding: 'utf8',
    // isolate BOTH the harness home and the project registry (orient self-heals the registry)
    env: { ...process.env, CLAUDE_HOME: home, CLAUDE_KIT_REGISTRY: join(home, 'registry.json') },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

function bootstrap(home, registry, extraEnv = {}) {
  // cwd is a neutral temp dir (NOT a repo with .claude/memory) so the cwd-walk path is a no-op and
  // the registry sweep is what's under test. CLAUDE_KIT_PRIVATE points nowhere so no overlay runs.
  const neutralCwd = mkdtempSync(join(tmpdir(), 'kit-ml-cwd-'));
  fixtures.push(neutralCwd);
  const r = spawnSync(process.execPath, [BOOTSTRAP], {
    cwd: neutralCwd, encoding: 'utf8',
    env: {
      ...process.env, CLAUDE_HOME: home, CLAUDE_KIT_REGISTRY: registry,
      CLAUDE_KIT_PRIVATE: join(home, 'no-private'), CLAUDE_DATA: '', LINK_TOOLING: '', ...extraEnv,
    },
  });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}

// realpath equality with the case-fold a Windows junction needs (drive-letter case can differ).
function sameReal(a, b) {
  try { return realpathSync(a).toLowerCase() === realpathSync(b).toLowerCase(); } catch { return false; }
}

try {
  // ===== 1. lib semantics =====================================================
  {
    const home = freshHome();
    const prevHome = process.env.CLAUDE_HOME;
    process.env.CLAUDE_HOME = home; // in-process helpers read this at call time

    // (a) repo with NO committed memory -> nothing to unify TO; inert.
    const noMem = repo({ withMemory: false });
    ok('lib: a repo without .claude/memory classifies no-repo-memory', memoryUnification(noMem).status === 'no-repo-memory');
    ok('lib: unifyMemory on no-repo-memory is a no-op (action none)', unifyMemory(noMem).action === 'none');

    // (b) link ABSENT -> absent, then unifyMemory creates the link and it RESOLVES to repo memory.
    const r1 = repo();
    ok('lib: a missing harness dir classifies absent', memoryUnification(r1).status === 'absent');
    const linked = unifyMemory(r1);
    ok('lib: unifyMemory links the absent case (action linked)', linked.action === 'linked');
    ok('lib: the created harness link resolves to the committed memory', sameReal(harnessMemoryDir(r1), repoMemoryDir(r1)));
    ok('lib: a memory written via the harness path lands in the committed dir (real unification)',
      (() => { writeFileSync(join(harnessMemoryDir(r1), 'note.md'), 'x\n'); return existsSync(join(repoMemoryDir(r1), 'note.md')); })());

    // (c) idempotent: now UNIFIED, re-running is a no-op.
    ok('lib: after linking it classifies unified', memoryUnification(r1).status === 'unified');
    ok('lib: unifyMemory is idempotent (second run action none)', unifyMemory(r1).action === 'none');

    // (d) a STALE/broken link (target since removed) is absent → safely replaced, not diverged.
    //     A Windows junction can't be created dangling, so point it at a real dir, then delete that
    //     dir to dangle it — the genuine "repo moved / old link" case.
    const r2 = repo();
    const gone = mkdtempSync(join(tmpdir(), 'kit-ml-gone-'));
    mkdirSync(dirname(harnessMemoryDir(r2)), { recursive: true });
    symlinkSync(gone, harnessMemoryDir(r2), process.platform === 'win32' ? 'junction' : 'dir');
    rmSync(gone, { recursive: true, force: true }); // now the link dangles
    ok('lib: a broken harness link classifies absent (replaceable)', memoryUnification(r2).status === 'absent');
    ok('lib: unifyMemory replaces a broken link and resolves to committed memory',
      unifyMemory(r2).action === 'linked' && sameReal(harnessMemoryDir(r2), repoMemoryDir(r2)));

    // (e) an EMPTY real harness dir is a safe placeholder → absent, replaced (no real memory lost).
    const r3 = repo();
    mkdirSync(harnessMemoryDir(r3), { recursive: true });
    ok('lib: an empty real harness dir classifies absent (not diverged)', memoryUnification(r3).status === 'absent');
    ok('lib: unifyMemory replaces the empty placeholder with the link', unifyMemory(r3).action === 'linked' && sameReal(harnessMemoryDir(r3), repoMemoryDir(r3)));

    // (f) DIVERGED: both sides real, non-empty, differing -> never clobber.
    const r4 = repo();
    const hd4 = seedHarnessRealCopy(home, r4, '# DIFFERENT local memory\n');
    ok('lib: two real differing copies classify diverged', memoryUnification(r4).status === 'diverged');
    const dv = unifyMemory(r4);
    ok('lib: unifyMemory does NOT clobber a divergence (action diverged)', dv.action === 'diverged');
    ok('lib: the divergent local copy is left intact (still a real dir, still its content)',
      lstatSync(hd4).isDirectory() && !lstatSync(hd4).isSymbolicLink() && readFileSync(join(hd4, 'MEMORY.md'), 'utf8').includes('DIFFERENT local'));

    // (g) the fix command names both paths + the right primitive for the platform.
    const cmd = memoryLinkCommand(r4);
    ok('lib: memoryLinkCommand names both endpoints',
      cmd.includes(harnessMemoryDir(r4)) && cmd.includes(repoMemoryDir(r4)));
    ok('lib: memoryLinkCommand uses the platform link primitive',
      process.platform === 'win32' ? /Junction/i.test(cmd) : /ln -s/.test(cmd));

    // (h) fail-open: a bogus root never throws.
    ok('lib: memoryUnification fails open on a bad root', (() => { try { return memoryUnification(null).status === 'no-repo-memory'; } catch { return false; } })());

    if (prevHome === undefined) delete process.env.CLAUDE_HOME; else process.env.CLAUDE_HOME = prevHome;
  }

  // ===== 2. orient.mjs — the three SessionStart branches ======================
  {
    // (a) LINK-ABSENT branch: orient AUTO-HEALS on resume and says so; the harness dir is now the
    //     committed memory. This is the "fresh machine never silently writes local" proof.
    {
      const home = freshHome();
      const d = repo();
      const hd = harnessUnder(home, d);
      ok('orient: a fresh machine starts with no harness link', !existsSync(hd));
      const r = orient(d, home);
      ok('orient: link-absent → emits MEMORY LINK HEALED', r.code === 0 && r.out.includes('MEMORY LINK HEALED'));
      ok('orient: link-absent → the harness dir now resolves to committed memory (healed)', sameReal(hd, repoMemoryDir(d)));
    }

    // (b) LINK-PRESENT branch: a second resume is silent — already unified, nothing to heal/warn.
    {
      const home = freshHome();
      const d = repo();
      orient(d, home); // first run heals
      const r2 = orient(d, home); // second run: unified
      ok('orient: link-present (already unified) → no memory banner at all',
        r2.code === 0 && !r2.out.includes('MEMORY LINK HEALED') && !r2.out.includes('MEMORY SPLIT') && !r2.out.includes('MEMORY NOT UNIFIED'));
    }

    // (c) DIVERGED branch: loud warning with the exact fix; the local copy is NOT clobbered.
    {
      const home = freshHome();
      const d = repo();
      const hd = seedHarnessRealCopy(home, d, '# local-only divergent memory\n');
      const r = orient(d, home);
      ok('orient: diverged → loud MEMORY SPLIT warning', r.code === 0 && r.out.includes('MEMORY SPLIT'));
      ok('orient: diverged warning carries the exact link fix command',
        process.platform === 'win32' ? /Junction/i.test(r.out) : r.out.includes('ln -s'));
      ok('orient: diverged → the local copy is NOT clobbered (still real, still its content)',
        lstatSync(hd).isSymbolicLink() === false && readFileSync(join(hd, 'MEMORY.md'), 'utf8').includes('divergent'));
    }

    // (d) no committed memory (an .ai-only project) → orient stays silent about memory.
    {
      const home = freshHome();
      const d = repo({ withMemory: false });
      const r = orient(d, home);
      ok('orient: a repo with no committed memory shows no memory banner',
        r.code === 0 && !r.out.includes('MEMORY LINK HEALED') && !r.out.includes('MEMORY SPLIT') && !r.out.includes('MEMORY NOT UNIFIED'));
    }
  }

  // ===== 3. bootstrap.mjs — adoption-time unification =========================
  {
    // (a) registry-driven: bootstrap links every known project's memory; idempotent on re-run.
    {
      const home = freshHome();
      const a = repo();
      const b = repo();
      const reg = join(home, 'reg.json');
      writeFileSync(reg, JSON.stringify({ dataRoot: null, projects: { a, b } }));
      const r = bootstrap(home, reg);
      ok('bootstrap: exits 0', r.code === 0);
      ok('bootstrap: reports the memory-unification step', r.out.includes('Project memory unification'));
      ok('bootstrap: links project A memory (resolves to committed)', sameReal(harnessUnder(home, a), repoMemoryDir(a)));
      ok('bootstrap: links project B memory (resolves to committed)', sameReal(harnessUnder(home, b), repoMemoryDir(b)));
      const r2 = bootstrap(home, reg);
      ok('bootstrap: re-run is idempotent (already unified, no new link line)', r2.code === 0 && /ok \(already unified\)/.test(r2.out) && !/linked .*->/.test(r2.out));
    }

    // (b) diverged project is REPORTED, never clobbered.
    {
      const home = freshHome();
      const d = repo();
      const hd = seedHarnessRealCopy(home, d, '# bootstrap divergent local\n');
      const reg = join(home, 'reg.json');
      writeFileSync(reg, JSON.stringify({ dataRoot: null, projects: { d } }));
      const r = bootstrap(home, reg);
      ok('bootstrap: a diverged project is reported as SPLIT', r.code === 0 && r.out.includes('SPLIT'));
      ok('bootstrap: the diverged local copy is left intact', readFileSync(join(hd, 'MEMORY.md'), 'utf8').includes('bootstrap divergent local'));
    }

    // (c) DRY_RUN: announces but creates no link.
    {
      const home = freshHome();
      const d = repo();
      const reg = join(home, 'reg.json');
      writeFileSync(reg, JSON.stringify({ dataRoot: null, projects: { d } }));
      const r = bootstrap(home, reg, { DRY_RUN: '1' });
      ok('bootstrap: DRY_RUN announces the unify but links nothing', r.code === 0 && /\[dry-run\] unify/.test(r.out) && !existsSync(harnessUnder(home, d)));
    }

    // (d) a project with no committed memory is silently skipped (no target to link to).
    {
      const home = freshHome();
      const d = repo({ withMemory: false });
      const reg = join(home, 'reg.json');
      writeFileSync(reg, JSON.stringify({ dataRoot: null, projects: { d } }));
      const r = bootstrap(home, reg);
      ok('bootstrap: a no-memory project is skipped (no unification section emitted)', r.code === 0 && !r.out.includes('Project memory unification'));
    }
  }
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
