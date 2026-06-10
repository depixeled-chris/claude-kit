#!/usr/bin/env node
// Hook test harness — run BEFORE shipping (npm test). Exercises each hook against mock
// payloads in throwaway git fixtures and asserts exit codes / output. Tests the dev-repo
// hooks directly (no install needed), so it's the fast pre-ship gate. exit 0 = all pass.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { aheadBehind, projectAiDirs } from '../hooks/lib.mjs';

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

function hook(name, payload, cwd, extraEnv) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], { input: JSON.stringify(payload), cwd, encoding: 'utf8', env: { ...ENV, ...extraEnv } });
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
  if (withCode) {
    // staged, not just untracked — KIT-T052: a bare `git commit` is judged on the STAGED set
    writeFileSync(join(d, 'foo.ts'), 'function f() { return doStuff(42); }\n');
    execFileSync('git', ['add', 'foo.ts'], { cwd: d, stdio: 'ignore' });
  }
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

  // commit-gate (KIT-T052: PowerShell wiring + pathspec/staged judging)
  const wiring = JSON.parse(readFileSync(join(HOOKS, 'hooks.json'), 'utf8'));
  const cgMatcher = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('commit-gate'))).matcher;
  ok('commit-gate: wired for PowerShell as well as Bash', /\bBash\b/.test(cgMatcher) && /\bPowerShell\b/.test(cgMatcher));
  const bgEntry = wiring.hooks.PreToolUse.find((e) => e.hooks.some((h) => h.command.includes('branch-guard')));
  ok('branch-guard: wired into hooks.json for Bash AND PowerShell (KIT-T082)',
    !!bgEntry && /\bBash\b/.test(bgEntry.matcher) && /\bPowerShell\b/.test(bgEntry.matcher));

  const mixed = adopted(true); // staged foo.ts + an untracked doc
  writeFileSync(join(mixed, 'README.md'), '# readme\n');
  ok('commit-gate: pathspec docs-only commit passes despite dirty code (KIT-T052)',
    hook('commit-gate.mjs', { tool_input: { command: `git -C ${mixed} commit -m x README.md` } }, clean).code === 0);
  ok('commit-gate: pathspec code commit, no cite -> block (KIT-T052)',
    hook('commit-gate.mjs', { tool_input: { command: `git -C ${mixed} commit -m x foo.ts` } }, clean).code === 2);

  const stagedDocs = adopted(false); // docs staged, code merely untracked
  writeFileSync(join(stagedDocs, 'foo.ts'), 'function f() { return doStuff(42); }\n');
  writeFileSync(join(stagedDocs, 'README.md'), '# readme\n');
  execFileSync('git', ['add', 'README.md'], { cwd: stagedDocs, stdio: 'ignore' });
  ok('commit-gate: bare commit judges the staged set, not the dirty tree (KIT-T052)',
    hook('commit-gate.mjs', { tool_input: { command: `git -C ${stagedDocs} commit -m x` } }, clean).code === 0);

  // aheadBehind + unpushed nag (KIT-T054)
  {
    const base = mkdtempSync(join(tmpdir(), 'kit-ab-'));
    fixtures.push(base);
    const g = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const bare = join(base, 'r.git');
    mkdirSync(bare);
    g(['init', '-q', '--bare', bare], base);
    const cloneOf = (name) => {
      const d = join(base, name);
      g(['clone', '-q', bare, d], base);
      g(['config', 'user.email', 't@t'], d);
      g(['config', 'user.name', 't'], d);
      return d;
    };
    const a = cloneOf('a');
    writeFileSync(join(a, 'f.txt'), 'seed\n');
    g(['add', '-A'], a); g(['commit', '-q', '-m', 'seed'], a); g(['push', '-q', '-u', 'origin', 'HEAD'], a);
    const b = cloneOf('b');

    writeFileSync(join(b, 'g.txt'), 'B\n');
    g(['add', '-A'], b); g(['commit', '-q', '-m', 'B1'], b); g(['push', '-q'], b);
    let ab = aheadBehind(a, { fetch: true });
    ok('aheadBehind: behind-only after the other machine pushes', !!ab && ab.ahead === 0 && ab.behind === 1 && !ab.diverged);

    writeFileSync(join(a, 'f.txt'), 'A\n');
    g(['add', '-A'], a); g(['commit', '-q', '-m', 'A1'], a);
    ab = aheadBehind(a);
    ok('aheadBehind: diverged when both machines moved', !!ab && ab.ahead === 1 && ab.behind === 1 && ab.diverged);

    g(['pull', '-q', '--rebase'], a);
    ab = aheadBehind(a);
    ok('aheadBehind: ahead-only after rebase', !!ab && ab.ahead === 1 && ab.behind === 0 && !ab.diverged);

    g(['remote', 'set-url', 'origin', join(base, 'nonexistent.git')], a);
    ab = aheadBehind(a, { fetch: true });
    ok('aheadBehind: offline fetch fails open (stale counts, no throw)', !!ab && ab.ahead === 1 && ab.behind === 0);

    ok('aheadBehind: no upstream -> null', aheadBehind(repo()) === null);

    // Stop-time unpushed nag: adopted repo, remote configured, >=3 local-only commits
    g(['remote', 'set-url', 'origin', bare], a);
    mkdirSync(join(a, '.ai'));
    writeFileSync(join(a, 'h.txt'), '1\n'); g(['add', '-A'], a); g(['commit', '-q', '-m', 'c2'], a);
    writeFileSync(join(a, 'h.txt'), '2\n'); g(['add', '-A'], a); g(['commit', '-q', '-m', 'c3'], a);
    const nag = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, a);
    ok('housekeeping Stop nags on unpushed pile-up', nag.code === 0 && nag.out.includes('unpushed commit(s)'), );
    const fresh = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, clean);
    ok('housekeeping Stop stays quiet about pushes on a clean repo', fresh.code === 0 && !fresh.out.includes('unpushed commit(s)'));
  }

  // pre-write (code-quality gate; strings are stripped so payload 42s are intentional)
  // fail-open + central enumeration (KIT-T055)
  ok('pre-write: throw-inducing payload fails OPEN (exit 0, not 1)',
    (() => { const r = hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 12345 } }, clean); return r.code === 0 && r.out.includes('failing open'); })());
  {
    const central = mkdtempSync(join(tmpdir(), 'kit-central-'));
    fixtures.push(central);
    mkdirSync(join(central, 'projects', 'centralonly'), { recursive: true });
    writeFileSync(join(central, 'projects', 'centralonly', 'config.yml'), 'ids:\n  key: "CEN"\n');
    writeFileSync(TMP_REG, JSON.stringify({ dataRoot: central, projects: {} }));
    const prevReg = process.env.CLAUDE_KIT_REGISTRY;
    process.env.CLAUDE_KIT_REGISTRY = TMP_REG;
    const dirs = projectAiDirs();
    if (prevReg === undefined) delete process.env.CLAUDE_KIT_REGISTRY; else process.env.CLAUDE_KIT_REGISTRY = prevReg;
    writeFileSync(TMP_REG, '{}');
    ok('projectAiDirs enumerates central-dataRoot-only projects (KIT-T055 readdirSync fix)',
      dirs.some((d) => d.name === 'centralonly'));
  }

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
  // KIT-T077 — magic-number precision: named/data/radix/regex idioms pass; real magic still blocks.
  ok('pre-write: multi-line const array data rows pass (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'const DIMS = [\n  1920,\n  1080,\n];\n' } }, clean).code === 0);
  ok('pre-write: named default parameter passes (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'function retry(fn, attempts = 5) {\n  return fn(attempts);\n}\n' } }, clean).code === 0);
  ok('pre-write: mid-line named assignment passes (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'if (!opts.timeout) opts.timeout = 5000;\n' } }, clean).code === 0);
  ok('pre-write: parseInt radix passes (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'export function toInt(s) {\n  return parseInt(s, 10);\n}\n' } }, clean).code === 0);
  ok('pre-write: regex-literal quantifiers pass after = (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'export function f(id) {\n  const ok = /^x{4}-y{6}$/;\n  return ok.test(id);\n}\n' } }, clean).code === 0);
  ok('pre-write: regex-literal after return passes (KIT-T077)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'export function isId(s) {\n  return /^[a-z]{8}$/.test(s);\n}\n' } }, clean).code === 0);
  ok('pre-write: division by a magic number STILL blocks (KIT-T077 non-regression)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'export function third(x) {\n  return x / 3;\n}\n' } }, clean).code === 2);
  ok('pre-write: comparison to a magic number STILL blocks (KIT-T077 non-regression)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.ts', content: 'export function gone(s) {\n  return s.status === 404;\n}\n' } }, clean).code === 2);

  ok('pre-write: plain css one-off literals pass (no first-class variables)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.css', content: '.a { font-size: 30px; font-weight: 700; }\n' } }, clean).code === 0);
  ok('pre-write: scss reused literal hardcoded blocks (should be a token)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '.a{padding:24px}.b{margin:24px}.c{gap:24px}\n' } }, clean).code === 2);
  ok('pre-write: scss reused color hardcoded blocks (should be a token)',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '.a{color:#3366ff}.b{border-color:#3366ff}.c{background:#3366ff}\n' } }, clean).code === 2);
  ok('pre-write: scss literal declared as variable passes',
    hook('pre-write.mjs', { tool_input: { file_path: '/x/a.scss', content: '$gap: 24px;\n.a{padding:$gap}.b{margin:$gap}.c{gap:$gap}\n' } }, clean).code === 0);

  // orient / flush emit in adopted repos, stay silent otherwise
  // KIT-T057 — legacy .claudekit-ignore is retired: warns with the migration, no longer bypasses.
  {
    const legacy = adopted(false);
    writeFileSync(join(legacy, '.claudekit-ignore'), '');
    const r = hook('pre-write.mjs', { tool_input: { file_path: join(legacy, 'a.ts'), content: 'function f(x) {\n  return x * 1337;\n}\n' } }, legacy);
    ok('pre-write: legacy .claudekit-ignore no longer bypasses (still blocks)', r.code === 2);
    ok('pre-write: legacy marker warns with the yaml migration', r.out.includes('RETIRED') && r.out.includes('.claude-kit-ignore.yaml'));
  }

  // KIT-T058 — coverage for the formerly zero-test hooks ----------------------------

  // housekeeping: thresholds against a throwaway HOME (USERPROFILE drives os.homedir()).
  const homeEnv = (h) => ({ USERPROFILE: h, HOME: h });
  {
    const freshHome = mkdtempSync(join(tmpdir(), 'kit-home-'));
    fixtures.push(freshHome);
    const enc = freshHome.replace(/[:\\/ ]/g, '-');
    mkdirSync(join(freshHome, '.claude', 'projects', enc, 'memory'), { recursive: true });
    writeFileSync(join(freshHome, '.claude', 'projects', enc, 'memory', '.last-reviewed'), '');
    writeFileSync(join(freshHome, '.claude', '.maintenance-last-reviewed'), '');
    const r = hook('housekeeping.mjs', {}, clean, homeEnv(freshHome));
    ok('housekeeping: fresh review timestamps stay silent', r.code === 0 && !r.out.includes('REVIEW DUE'));

    const staleHome = mkdtempSync(join(tmpdir(), 'kit-home-'));
    fixtures.push(staleHome);
    const s = hook('housekeeping.mjs', {}, clean, homeEnv(staleHome));
    ok('housekeeping: missing timestamps nag BOTH reviews', s.code === 0 && s.out.includes('MEMORY REVIEW DUE') && s.out.includes('MAINTENANCE REVIEW DUE'));
    const stop = hook('housekeeping.mjs', { hook_event_name: 'Stop' }, clean, homeEnv(staleHome));
    ok('housekeeping: Stop repeats pending reviews', stop.code === 0 && stop.out.includes('pending before end-of-session'));
  }

  // hydrate-cache: contract = NEVER wedges; DB isolated via CLAUDE_PLUGIN_ROOT.
  {
    const dbBase = mkdtempSync(join(tmpdir(), 'kit-db-'));
    fixtures.push(dbBase);
    const dbEnv = { CLAUDE_PLUGIN_ROOT: dbBase };
    ok('hydrate-cache: unadopted repo no-ops', hook('hydrate-cache.mjs', {}, repo(), dbEnv).code === 0);
    const hyd = adopted(false);
    mkdirSync(join(hyd, '.ai', 'tickets'), { recursive: true });
    writeFileSync(join(hyd, '.ai', 'tickets', 'H-T001-x.md'), '---\nid: H-T001\ntitle: x\nstatus: todo\n---\n');
    writeFileSync(TMP_REG, JSON.stringify({ projects: { hydeproj: hyd } }));
    const r1 = hook('hydrate-cache.mjs', {}, hyd, dbEnv);
    const r2 = hook('hydrate-cache.mjs', {}, hyd, dbEnv);
    ok('hydrate-cache: refresh path exits clean (fail-open contract)', r1.code === 0 && r2.code === 0);
    ok('hydrate-cache: second run is fresh (no refresh receipt)', !r2.out.includes('refreshed'));
    writeFileSync(TMP_REG, 'garbage{{{not json');
    ok('hydrate-cache: broken registry fails open', hook('hydrate-cache.mjs', {}, hyd, dbEnv).code === 0);
    writeFileSync(TMP_REG, '{}');
  }

  // lint + jscpd: skip rules + advisory-never-block. Gap logs go to a throwaway HOME.
  {
    const gapHome = mkdtempSync(join(tmpdir(), 'kit-home-'));
    fixtures.push(gapHome);
    const env = homeEnv(gapHome);
    const lr = adopted(false);
    writeFileSync(join(lr, 'package-lock.json'), '{}');
    let r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'package-lock.json') } }, lr, env);
    ok('lint: lockfile skipped silently', r.code === 0 && r.out.trim() === '');
    mkdirSync(join(lr, 'node_modules', 'x'), { recursive: true });
    writeFileSync(join(lr, 'node_modules', 'x', 'y.js'), 'var a = 1;\n');
    r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'node_modules', 'x', 'y.js') } }, lr, env);
    ok('lint: vendored path skipped silently', r.code === 0 && r.out.trim() === '');
    writeFileSync(join(lr, 'app.ts'), 'export const a = 1;\n');
    r = hook('lint.mjs', { tool_input: { file_path: join(lr, 'app.ts') } }, lr, env);
    ok('lint: ts without package.json warns but never blocks', r.code === 0 && r.out.includes('No package.json'));

    writeFileSync(join(lr, 'README.md'), '# x\n');
    r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'README.md') } }, lr, env);
    ok('jscpd: doc/data ext skipped silently', r.code === 0 && r.out.trim() === '');
    r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'node_modules', 'x', 'y.js') } }, lr, env);
    ok('jscpd: vendored path skipped silently', r.code === 0 && r.out.trim() === '');
    r = hook('jscpd.mjs', { tool_input: { file_path: join(lr, 'app.ts') } }, lr, env);
    ok('jscpd: missing tool fails open (gap logged, no warn, exit 0)', r.code === 0 && !r.out.includes('WARN'));
  }

  // commit-gate: id-integrity branch (duplicate ids in the store block the commit).
  {
    const dup = adopted(false);
    mkdirSync(join(dup, '.ai', 'tickets'), { recursive: true });
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-a.md'), '---\nid: T-001\ntitle: a\nstatus: todo\n---\n');
    writeFileSync(join(dup, '.ai', 'tickets', 'T-001-b.md'), '---\nid: T-001\ntitle: b\nstatus: todo\n---\n');
    execFileSync('git', ['add', '-A'], { cwd: dup, stdio: 'ignore' });
    const r = hook('commit-gate.mjs', { tool_input: { command: `git -C ${dup} commit -m x` } }, clean);
    ok('commit-gate: duplicate store ids block the commit (id-integrity)', r.code === 2 && r.out.includes('DUPLICATE'));
  }

  // commit-gate: evidence floor (KIT-T061) — a CLOSING transition needs a test artifact or escape.
  {
    const seed = (status, notes) => `---\nid: KIT-T001\ntitle: seed\ntype: feature\nstatus: ${status}\n---\n\n## Notes\n${notes}\n`;
    const mkEf = () => {
      const ef = adopted(false);
      execFileSync('git', ['config', 'user.email', 't@t'], { cwd: ef, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 't'], { cwd: ef, stdio: 'ignore' });
      writeFileSync(join(ef, '.ai', 'config.yml'), 'uat:\n  default: none\nids:\n  key: "KIT"\n  prefix: "KIT-T"\n  pad: 3\n');
      mkdirSync(join(ef, '.ai', 'tickets'), { recursive: true });
      return ef;
    };
    const seedCommit = (d, text) => {
      const p = join(d, '.ai', 'tickets', 'KIT-T001-x.md');
      writeFileSync(p, text);
      execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'ignore' });
      execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: d, stdio: 'ignore' });
      return p;
    };
    const stageEdit = (d, p, text) => { writeFileSync(p, text); execFileSync('git', ['add', '-A'], { cwd: d, stdio: 'ignore' }); };
    const cg = (d) => hook('commit-gate.mjs', { tool_input: { command: `git -C ${d} commit -m x` } }, clean);

    const a = mkEf(); stageEdit(a, seedCommit(a, seed('doing', 'working.')), seed('done', 'finished it.'));
    const ra = cg(a);
    ok('commit-gate: closing transition with no test evidence blocks (KIT-T061)', ra.code === 2 && /KIT-T061/.test(ra.out) && ra.out.includes('KIT-T001'));

    const b = mkEf(); stageEdit(b, seedCommit(b, seed('doing', 'working.')), seed('done', 'ran npm test — 5 passed.'));
    ok('commit-gate: closing transition WITH a suite-run reference passes (KIT-T061)', cg(b).code === 0);

    const c = mkEf(); stageEdit(c, seedCommit(c, seed('doing', 'working.')), seed('done', 'docs only [no-test: pure doc edit].'));
    ok('commit-gate: [no-test: reason] escape passes the floor (KIT-T061)', cg(c).code === 0);

    const e = mkEf(); stageEdit(e, seedCommit(e, seed('todo', 'initial.')), seed('todo', 'expanded the description.'));
    ok('commit-gate: a non-closing ticket edit is unaffected by the floor (KIT-T061)', cg(e).code === 0);
  }

  // branch-guard (KIT-T082): block a branch FLIP of a shared checkout; allow file-ops/worktree/escape.
  {
    const bg = adopted(false);
    execFileSync('git', ['config', 'user.email', 't@t'], { cwd: bg, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 't'], { cwd: bg, stdio: 'ignore' });
    writeFileSync(join(bg, 'f.txt'), 'x\n');
    execFileSync('git', ['add', '-A'], { cwd: bg, stdio: 'ignore' });
    execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: bg, stdio: 'ignore' });
    execFileSync('git', ['branch', 'feature-x'], { cwd: bg, stdio: 'ignore' });
    const bgHook = (command, cwd = bg) => hook('branch-guard.mjs', { tool_input: { command } }, cwd);

    ok('branch-guard: git switch <branch> blocks (KIT-T082)', (() => { const r = bgHook('git switch feature-x'); return r.code === 2 && r.out.includes('KIT-T082'); })());
    ok('branch-guard: git checkout -b <new> blocks', bgHook('git checkout -b brand-new').code === 2);
    ok('branch-guard: git checkout <existing-branch> blocks', bgHook('git checkout feature-x').code === 2);
    ok('branch-guard: git switch -c <new> blocks', bgHook('git switch -c another').code === 2);
    ok('branch-guard: file-restore checkout (-- file) is allowed', bgHook('git checkout -- f.txt').code === 0);
    ok('branch-guard: checkout of a non-branch path is allowed', bgHook('git checkout f.txt').code === 0);
    ok('branch-guard: git worktree add is allowed (the safe path)', bgHook('git worktree add ../wt -b feature-x').code === 0);
    ok('branch-guard: git branch (no switch) is allowed', bgHook('git branch list-only').code === 0);
    ok('branch-guard: [allow-branch:] escape is allowed', bgHook('git switch feature-x [allow-branch: deliberate]').code === 0);
    ok('branch-guard: CLAUDE_KIT_ALLOW_BRANCH=1 escape is allowed', hook('branch-guard.mjs', { tool_input: { command: 'git switch feature-x' } }, bg, { CLAUDE_KIT_ALLOW_BRANCH: '1' }).code === 0);
    ok('branch-guard: a non-git command no-ops', bgHook('echo switch checkout').code === 0);
    ok('branch-guard: non-adopted repo no-ops', hook('branch-guard.mjs', { tool_input: { command: 'git switch feature-x' } }, repo()).code === 0);
  }

  // orient: standing-decision scope filter (KIT-T046 behavior).
  {
    const o = adopted(false);
    mkdirSync(join(o, '.ai', 'decisions'), { recursive: true });
    writeFileSync(join(o, '.ai', 'decisions', 'D-001.md'), '---\nid: D-001\ntitle: out-of-scope worldgen rule\nstanding: true\nscope: worldgen\n---\n');
    writeFileSync(join(o, '.ai', 'decisions', 'D-002.md'), '---\nid: D-002\ntitle: parser files rule\nstanding: true\npaths: src/parser/*\n---\n');
    writeFileSync(join(o, '.ai', 'decisions', 'D-003.md'), '---\nid: D-003\ntitle: global invariant\nstanding: true\n---\n');
    mkdirSync(join(o, 'src', 'parser'), { recursive: true });
    writeFileSync(join(o, 'src', 'parser', 'lex.ts'), 'export const t = 1;\n');
    // stage so porcelain reports the FILE path (untracked dirs collapse to `?? src/`,
    // which no paths-glob can match)
    execFileSync('git', ['add', '-A'], { cwd: o, stdio: 'ignore' });
    const r = hook('orient.mjs', {}, o);
    ok('orient: in-scope (paths glob) standing decision surfaces', r.out.includes('D-002'));
    ok('orient: scope-less standing decision always surfaces', r.out.includes('D-003'));
    ok('orient: out-of-scope standing decision collapses to a scope pointer',
      r.out.includes('+1 more standing decision(s) out of scope (scopes: worldgen)'));
    const standingSection = r.out.split('--- STANDING')[1].split('\n---')[0];
    ok('orient: standing section itself omits the out-of-scope decision', !standingSection.includes('D-001'));
  }

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
