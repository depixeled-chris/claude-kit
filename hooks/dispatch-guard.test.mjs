// Automated test for the dispatch-ladder gate (hooks/dispatch-guard.mjs). Asserts:
// BLOCK on explicit fable and on a model-less delegation inheriting a fable session;
// ALLOW on explicit opus, frontmatter-pinned kit agents, non-fable sessions, the
// [allow-fable] escape, missing transcripts, unadopted repos, and malformed payloads.
// Run: node hooks/dispatch-guard.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./dispatch-guard.mjs', import.meta.url));
let failures = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  return dir;
}

function transcript(dir, name, model) {
  const file = join(dir, `${name}.jsonl`);
  const rows = [
    JSON.stringify({ type: 'user', message: { content: 'hi' } }),
    JSON.stringify({ type: 'assistant', message: { model, content: [] } }),
  ];
  writeFileSync(file, rows.join('\n') + '\n');
  return file;
}

function runRaw(dir, stdin) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: stdin,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_ALLOW_FABLE: '', CLAUDE_PLUGIN_ROOT: '' },
  });
  return { code: r.status, err: r.stderr || '' };
}

function run(dir, toolInput, transcriptPath) {
  return runRaw(
    dir,
    JSON.stringify({ tool_name: 'Agent', tool_input: toolInput, transcript_path: transcriptPath })
  );
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

const d = makeRepo();
const un = makeRepo({ adopt: false });
const fable = transcript(d, 'fable-session', 'claude-fable-5');
const opus = transcript(d, 'opus-session', 'claude-opus-4-8');

// BLOCK — the silent inherit: no model, no pin, fable session.
expect('blocks inherit from a fable session (unpinned type)', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, fable).code, 2);
expect('blocks inherit on Explore too', run(d, { subagent_type: 'Explore', prompt: 'x' }, fable).code, 2);

// ALLOW — explicitly chosen, pinned, escaped, or indeterminate.
expect('allows explicit opus from a fable session', run(d, { subagent_type: 'general-purpose', model: 'opus', prompt: 'x' }, fable).code, 0);
expect('allows explicit haiku', run(d, { subagent_type: 'general-purpose', model: 'haiku', prompt: 'x' }, fable).code, 0);
expect('allows explicit fable (a chosen tier — deep-tier dispatch)', run(d, { subagent_type: 'general-purpose', model: 'fable', prompt: 'x' }, fable).code, 0);
expect('allows pinned kit agent (frontmatter model: opus)', run(d, { subagent_type: 'claude-kit:researcher', prompt: 'x' }, fable).code, 0);
expect('allows [allow-fable: reason] escape on a model-less inherit', run(d, { subagent_type: 'general-purpose', prompt: 'judge panel [allow-fable: hardest-reasoning verify]' }, fable).code, 0);
expect('allows inherit from a non-fable session', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, opus).code, 0);
expect('allows when the transcript is missing (indeterminate)', run(d, { subagent_type: 'general-purpose', prompt: 'x' }, join(d, 'missing.jsonl')).code, 0);

// FAIL-OPEN — never wedge a delegation.
expect('allows on an unadopted repo', run(un, { subagent_type: 'general-purpose', prompt: 'x' }, fable).code, 0);
expect('allows on malformed stdin', runRaw(d, 'not json at all').code, 0);

// Block message quality — the fix and the escape are both named.
const msg = run(d, { subagent_type: 'general-purpose', prompt: 'x' }, fable).err;
expect("block message names the fix (model:'opus')", /model:'opus'/.test(msg) ? 1 : 0, 1);
expect('block message names the escape token', /\[allow-fable/.test(msg) ? 1 : 0, 1);
expect('block message carries the exclude footer', /dispatch-ladder/.test(msg) ? 1 : 0, 1);

process.exit(failures ? 1 : 0);
