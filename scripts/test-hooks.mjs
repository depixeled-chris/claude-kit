#!/usr/bin/env node
// Hook test harness — run BEFORE shipping (npm test). Exercises each hook against mock
// payloads in throwaway git fixtures and asserts exit codes / output. Tests the dev-repo
// hooks directly (no install needed), so it's the fast pre-ship gate. exit 0 = all pass.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = join(ROOT, 'hooks');
const SCRIPTS = join(ROOT, 'scripts');
const fixtures = [];
let pass = 0;
let fail = 0;

// Isolate every spawned hook/script from the real ~/.claude registry — orient self-heals it,
// so without this the suite would pollute the maintainer's registry with throwaway fixtures.
const TMP_REG = join(mkdtempSync(join(tmpdir(), 'kit-reg-')), 'registry.json');
fixtures.push(dirname(TMP_REG));
const ENV = { ...process.env, CLAUDE_KIT_REGISTRY: TMP_REG };

function hook(name, payload, cwd) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], { input: JSON.stringify(payload), cwd, encoding: 'utf8', env: ENV });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
}
function survey(args, cwd, regPath) {
  const r = spawnSync(process.execPath, [join(SCRIPTS, 'survey.mjs'), ...args], {
    cwd, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_REGISTRY: regPath },
  });
  return `${r.stdout || ''}${r.stderr || ''}`;
}
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
function repo(withCode) {
  const d = mkdtempSync(join(tmpdir(), 'kit-test-'));
  fixtures.push(d);
  execFileSync('git', ['init', '-q'], { cwd: d, stdio: 'ignore' });
  return d;
}
function adopted(withCode) {
  const d = repo();
  mkdirSync(join(d, '.ai'));
  if (withCode) writeFileSync(join(d, 'foo.ts'), 'function f() { return doStuff(42); }\n');
  return d;
}
function surveyRepo() {
  const d = repo();
  writeFileSync(join(d, '.claude-project'), 'project: proj\n');
  mkdirSync(join(d, '.ai', 'tickets'), { recursive: true });
  writeFileSync(join(d, '.ai', 'tickets', 'T-001-r.md'), '---\nid: T-001\ntitle: A review item\nstatus: review\n---\n');
  writeFileSync(join(d, '.ai', 'tickets', 'T-002-d.md'), '---\nid: T-002\ntitle: A doing item\nstatus: doing\n---\n');
  writeFileSync(join(d, '.ai', 'SESSION.md'), '# S\n\n### NEEDS CHRIS\n- decide the thing\n');
  return d;
}

try {
  const tgt = adopted(true); // adopted repo with uncommitted code
  const clean = adopted(false);

  // commit-gate (the cwd-resolution + cite logic)
  ok('commit-gate: cd-target uncommitted code, no cite -> block',
    hook('commit-gate.mjs', { tool_input: { command: `cd ${tgt} && git commit -m x` } }, clean).code === 2);
  ok('commit-gate: git -C target, no cite -> block',
    hook('commit-gate.mjs', { tool_input: { command: `git -C ${tgt} commit -m x` } }, clean).code === 2);
  ok('commit-gate: cite (HOD-T045) bypasses',
    hook('commit-gate.mjs', { tool_input: { command: `cd ${tgt} && git commit -m HOD-T045` } }, clean).code === 0);
  ok('commit-gate: clean cwd passes',
    hook('commit-gate.mjs', { tool_input: { command: 'git commit -m x' } }, clean).code === 0);
  ok('commit-gate: non-commit no-ops',
    hook('commit-gate.mjs', { tool_input: { command: `cd ${tgt} && git status` } }, clean).code === 0);

  // pre-write (code-quality gate; strings are stripped so payload 42s are intentional)
  ok('pre-write: bare magic number blocks (non-declaration line)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'function f(x) {\n  return x * 1337;\n}\n' } }, clean).code === 2);
  ok('pre-write: named constant passes',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'const FACTOR = 1337;\nconst r = compute(seed) * FACTOR;\n' } }, clean).code === 0);
  ok('pre-write: data file skipped',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.json', content: '{ "n": 1337 }' } }, clean).code === 0);
  ok('pre-write: doc never blocks',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.md', content: '# note 1337\n' } }, clean).code === 0);
  ok('pre-write: markup (.html) skips code checks (regression: brand "GTA 7")',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/i.html', content: '<title>GTA 7 — Guns, Traffic & Anarchy</title>\n' } }, clean).code === 0);
  // KIT-T032 — numerics in PROSE (string/template/heredoc, line + block comments) are not
  // magic constants. orient.mjs's prose heredoc carried "60-75k"/"70k"/"5-line" and was
  // wrongly blocked. The rule itself is unchanged: a bare code constant must still fail.
  ok('pre-write: numbers in a template-literal heredoc pass (KIT-T032)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'const out = [];\nout.push(`Budget 60-75k tokens, ~70k after the 5-line preamble.`);\n' } }, clean).code === 0);
  ok('pre-write: numbers in a line comment pass (KIT-T032)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: '// retry after 1337 ms, ceiling 9000\nconst r = compute();\n' } }, clean).code === 0);
  ok('pre-write: numbers in a block comment pass (KIT-T032)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: '/* threshold 1337\n   ceiling 9000 */\nconst r = compute();\n' } }, clean).code === 0);
  ok('pre-write: bare code constant still blocks even with prose numbers present (KIT-T032)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'function f(x) {\n  return x * 1337; // was 9000 before\n}\n' } }, clean).code === 2);
  ok('pre-write: plain css one-off literals pass (no first-class variables)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.css', content: '.a { font-size: 30px; font-weight: 700; }\n' } }, clean).code === 0);
  ok('pre-write: scss reused literal hardcoded blocks (should be a token)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '.a{padding:24px}.b{margin:24px}.c{gap:24px}\n' } }, clean).code === 2);
  ok('pre-write: scss reused color hardcoded blocks (should be a token)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '.a{color:#3366ff}.b{border-color:#3366ff}.c{background:#3366ff}\n' } }, clean).code === 2);
  ok('pre-write: scss literal declared as variable passes',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '$gap: 24px;\n.a{padding:$gap}.b{margin:$gap}.c{gap:$gap}\n' } }, clean).code === 0);

  // orient / flush emit in adopted repos, stay silent otherwise
  ok('orient: adopted repo emits orientation', /ORIENTATION/.test(hook('orient.mjs', { hook_event_name: 'SessionStart' }, clean).out));
  ok('flush: adopted repo emits flush reminder', /COMPACTION|flush/i.test(hook('flush.mjs', { hook_event_name: 'PreCompact' }, clean).out));
  const bare = repo();
  ok('orient: non-adopted repo is silent', hook('orient.mjs', {}, bare).out.trim() === '');

  // code-graph (KIT-T012): Stop hook refreshes a machine-local graph cache for an adopted
  // repo; isolated from the real ~/.claude via CLAUDE_CODE_GRAPH_CACHE. (Assert on cache-dir
  // contents, not a guessed filename — the cache key comes from git's normalized path.)
  const jsonCount = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).length : 0);
  const cgAdoptedCache = mkdtempSync(join(tmpdir(), 'kit-cg-a-'));
  const cgBareCache = mkdtempSync(join(tmpdir(), 'kit-cg-b-'));
  fixtures.push(cgAdoptedCache, cgBareCache);
  const cgRun = (cwd, cache) => spawnSync(process.execPath, [join(HOOKS, 'code-graph.mjs')], {
    input: '{}', cwd, encoding: 'utf8', env: { ...ENV, CLAUDE_CODE_GRAPH_CACHE: cache },
  });
  ok('code-graph: refreshes a machine-local cache for an adopted repo',
    cgRun(adopted(true), cgAdoptedCache).status === 0 && jsonCount(cgAdoptedCache) === 1);
  ok('code-graph: non-adopted repo writes no cache',
    cgRun(bare, cgBareCache).status === 0 && jsonCount(cgBareCache) === 0);

  // survey (T-001) — lazy "what needs me?" briefing + named deep-dive
  const sreg = join(mkdtempSync(join(tmpdir(), 'kit-sreg-')), 'registry.json');
  fixtures.push(dirname(sreg));
  const proj = surveyRepo();
  writeFileSync(sreg, JSON.stringify({ dataRoot: null, projects: { proj } }));

  const lazy = survey([], proj, sreg);
  ok('survey: lazy briefing leads with "waiting on you"', /WAITING ON YOU/.test(lazy));
  ok('survey: lazy surfaces a review ticket as waiting', lazy.includes('in review — awaiting'));
  ok('survey: lazy surfaces SESSION "needs" flags', lazy.includes('decide the thing'));
  ok('survey: lazy has per-project open-work counts', /Open work by project/.test(lazy) && lazy.includes('doing,'));

  const deep = survey(['proj'], proj, sreg);
  ok('survey: named arg gives a deep resume', deep.includes('deep resume: proj'));
  ok('survey: deep view lists open tickets', deep.includes('A doing item'));
  ok('survey: unknown project is flagged, not crashed', survey(['nope'], proj, sreg).includes('unknown project'));

  // registry self-heal round-trips through readRegistry (isolated path via env)
  process.env.CLAUDE_KIT_REGISTRY = join(mkdtempSync(join(tmpdir(), 'kit-rt-')), 'r.json');
  fixtures.push(dirname(process.env.CLAUDE_KIT_REGISTRY));
  const lib = await import('../hooks/lib.mjs');
  lib.recordProject('alpha', '/repo/alpha', '/data');
  const rr = lib.readRegistry();
  ok('registry: recordProject round-trips name + dataRoot', rr.projects.alpha === '/repo/alpha' && rr.dataRoot === '/data');
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
