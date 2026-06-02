#!/usr/bin/env node
// Hook test harness — run BEFORE shipping (npm test). Exercises each hook against mock
// payloads in throwaway git fixtures and asserts exit codes / output. Tests the dev-repo
// hooks directly (no install needed), so it's the fast pre-ship gate. exit 0 = all pass.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks');
const fixtures = [];
let pass = 0;
let fail = 0;

function hook(name, payload, cwd) {
  const r = spawnSync(process.execPath, [join(HOOKS, name)], { input: JSON.stringify(payload), cwd, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}` };
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

try {
  const tgt = adopted(true); // adopted repo with uncommitted code
  const clean = adopted(false);

  // commit-gate (the cwd-resolution + cite logic)
  ok('commit-gate: cd-target uncommitted code, no cite -> block',
    hook('commit-gate.mjs', { tool_input: { command: `cd ${tgt} && git commit -m x` } }, clean).code === 2);
  ok('commit-gate: git -C target, no cite -> block',
    hook('commit-gate.mjs', { tool_input: { command: `git -C ${tgt} commit -m x` } }, clean).code === 2);
  ok('commit-gate: cite (R045) bypasses',
    hook('commit-gate.mjs', { tool_input: { command: `cd ${tgt} && git commit -m R045` } }, clean).code === 0);
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

  // orient / flush emit in adopted repos, stay silent otherwise
  ok('orient: adopted repo emits orientation', /ORIENTATION/.test(hook('orient.mjs', { hook_event_name: 'SessionStart' }, clean).out));
  ok('flush: adopted repo emits flush reminder', /COMPACTION|flush/i.test(hook('flush.mjs', { hook_event_name: 'PreCompact' }, clean).out));
  const bare = repo();
  ok('orient: non-adopted repo is silent', hook('orient.mjs', {}, bare).out.trim() === '');
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
