#!/usr/bin/env node
// Tests for reconcile-central.mjs + the orient KIT-T134 tripwire. Builds a THROWAWAY world
// (a temp registry, a temp dataRoot git repo, and temp project repos) — NEVER the real
// registry or D:/dev/claude-kit-data. Asserts: a clean in-repo notebook MIGRATES (copied
// centrally, junctioned, gitignored, both commits made) while a split-brain project is
// REFUSED and left untouched; and orient fires the "not centralized" banner (but not for the
// kit itself). Hand-rolled harness like init-project.test.mjs. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { centralDataRoot } from '../hooks/lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'reconcile-central.mjs');
const ORIENT = resolve(HERE, '..', 'hooks', 'orient.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? `  (${detail})` : '')); }
}
function gitq(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout || '';
}
function initRepo(dir) {
  mkdirSync(dir, { recursive: true });
  gitq(['init', '-q'], dir);
  gitq(['config', 'user.email', 'test@test'], dir);
  gitq(['config', 'user.name', 'test'], dir);
}
const CONFIG = (key) => `ids:\n  key: "${key}"\n  prefix: "${key}-T"\n  pad: 3\n`;
function seedNotebook(aiDir, key, ticketIds) {
  mkdirSync(join(aiDir, 'tickets'), { recursive: true });
  writeFileSync(join(aiDir, 'config.yml'), CONFIG(key));
  for (const id of ticketIds) {
    writeFileSync(join(aiDir, 'tickets', `${id}.md`), `---\nid: ${id}\nstatus: todo\n---\n`);
  }
}
function runReconcile(registry, args) {
  const env = { ...process.env, CLAUDE_KIT_REGISTRY: registry };
  delete env.CLAUDE_DATA;
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', env });
  return `${r.stdout || ''}${r.stderr || ''}`;
}

try {
  // ---- (b) split-brain refusal + clean-case migration --------------------------
  // Expand the base to its long form: on Windows tmpdir carries an 8.3 short component
  // (e.g. RUNNER~1) that git expands but Node's plain realpathSync does not — the mismatch would
  // make centralDataRoot mis-detect an in-repo notebook as "already centralized" in-test.
  // realpathSync.native (GetFinalPathNameByHandle) expands short names. Real project paths
  // (D:/dev/...) have none, so this is a test-env normalization, not a product concern.
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'kit-recon-')));
  fixtures.push(base);

  const dataRoot = join(base, 'claude-kit-data');
  initRepo(dataRoot);
  mkdirSync(join(dataRoot, 'projects'), { recursive: true });
  writeFileSync(join(dataRoot, 'projects', '.keep'), '');
  gitq(['add', '-A'], dataRoot);
  gitq(['commit', '-q', '-m', 'seed data repo'], dataRoot);

  // clean project: in-repo .ai, tracked, NO central dir → should migrate.
  const clean = join(base, 'clean-proj');
  initRepo(clean);
  seedNotebook(join(clean, '.ai'), 'CLN', ['CLN-T001', 'CLN-T002']);
  gitq(['add', '-A'], clean);
  gitq(['commit', '-q', '-m', 'seed clean'], clean);

  // split project: in-repo .ai (2 tickets) AND a pre-existing central dir (1 ticket) → refuse.
  const split = join(base, 'split-proj');
  initRepo(split);
  seedNotebook(join(split, '.ai'), 'SPL', ['SPL-T001', 'SPL-T002', 'SPL-T003']);
  gitq(['add', '-A'], split);
  gitq(['commit', '-q', '-m', 'seed split'], split);
  seedNotebook(join(dataRoot, 'projects', 'split-proj'), 'SPL', ['SPL-T001']); // stale central copy
  gitq(['add', '-A'], dataRoot);
  gitq(['commit', '-q', '-m', 'stale central split'], dataRoot);

  const registry = join(base, 'registry.json');
  writeFileSync(registry, JSON.stringify({
    dataRoot,
    projects: { 'clean-proj': clean, 'split-proj': split, 'gone-proj': join(base, 'nope') },
  }));

  // Dry-run first: reports, changes nothing.
  const dry = runReconcile(registry, []);
  ok('dry-run marks clean project MIGRATE', /MIGRATE\s+clean-proj/.test(dry), dry);
  ok('dry-run marks split project REFUSE (split-brain)', /REFUSE\s+split-proj.*SPLIT-BRAIN/.test(dry), dry);
  ok('dry-run skips a missing repo', /SKIP\s+gone-proj/.test(dry), dry);
  ok('dry-run made NO central copy of clean', !existsSync(join(dataRoot, 'projects', 'clean-proj')), 'central clean dir should not exist yet');
  ok('dry-run left clean/.ai in-repo', centralDataRoot(clean) === null);

  // Execute.
  const exec = runReconcile(registry, ['--execute']);
  ok('execute reports clean MIGRATED', /MIGRATED\s+clean-proj/.test(exec), exec);
  ok('execute still REFUSES split-brain', /REFUSE\s+split-proj.*SPLIT-BRAIN/.test(exec), exec);

  // clean: content copied centrally, junctioned, gitignored, pointer written, .ai untracked.
  ok('clean: central copy exists with the tickets', existsSync(join(dataRoot, 'projects', 'clean-proj', 'tickets', 'CLN-T002.md')));
  ok('clean: .ai now resolves to the central data repo (junction)', centralDataRoot(clean) !== null, String(centralDataRoot(clean)));
  ok('clean: .gitignore now ignores .ai', /(^|\n)\.ai(\r?\n|$)/.test(existsSync(join(clean, '.gitignore')) ? readFileSync(join(clean, '.gitignore'), 'utf8') : ''));
  ok('clean: .claude-project pointer written', existsSync(join(clean, '.claude-project')) && /project:\s*clean-proj/.test(readFileSync(join(clean, '.claude-project'), 'utf8')));
  ok('clean: repo no longer tracks .ai', gitq(['ls-files', '.ai'], clean).trim() === '');
  ok('clean: data repo committed the back-fill', /back-fill clean-proj/.test(gitq(['log', '--oneline'], dataRoot)));
  ok('clean: project repo committed the centralize', /centralize \.ai/.test(gitq(['log', '--oneline'], clean)));

  // split: untouched — central still the stale 1-ticket copy, in-repo still 3 tickets.
  ok('split: central copy NOT clobbered (still 1 ticket)', !existsSync(join(dataRoot, 'projects', 'split-proj', 'tickets', 'SPL-T003.md')));
  ok('split: in-repo .ai left in place (still 3 tickets)', existsSync(join(split, '.ai', 'tickets', 'SPL-T003.md')) && centralDataRoot(split) === null);

  // ---- (c) orient tripwire fires (and not for the kit) -------------------------
  function runOrient(cwd, reg) {
    const env = { ...process.env, CLAUDE_KIT_REGISTRY: reg };
    delete env.CLAUDE_DATA;
    const r = spawnSync(process.execPath, [ORIENT], { cwd, encoding: 'utf8', env });
    return r.stdout || '';
  }
  const proj = join(base, 'tripwire-proj');
  initRepo(proj);
  seedNotebook(join(proj, '.ai'), 'TWP', ['TWP-T001']);
  gitq(['add', '-A'], proj);
  gitq(['commit', '-q', '-m', 'seed tripwire'], proj);
  const twReg = join(base, 'tw-registry.json');
  writeFileSync(twReg, JSON.stringify({ dataRoot, projects: {} }));
  ok('orient WARNS when in-repo notebook + registered dataRoot', /NOTEBOOK IN-REPO, NOT CENTRALIZED/.test(runOrient(proj, twReg)));

  // kit-self exemption: package.json name = claude-kit → no banner.
  writeFileSync(join(proj, 'package.json'), JSON.stringify({ name: 'claude-kit' }));
  ok('orient does NOT warn for the kit repo itself', !/NOT CENTRALIZED/.test(runOrient(proj, twReg)));

  // no dataRoot registered → no banner.
  const noDrReg = join(base, 'nodr-registry.json');
  writeFileSync(noDrReg, JSON.stringify({ projects: {} }));
  rmSync(join(proj, 'package.json'));
  ok('orient does NOT warn when no dataRoot is registered', !/NOT CENTRALIZED/.test(runOrient(proj, noDrReg)));
} finally {
  for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
}

console.log(`\nreconcile-central: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
