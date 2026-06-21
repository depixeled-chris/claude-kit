// Automated test for the landing-alert ratchet (hooks/land-alert.mjs).
// Spins up throwaway adopted repos + fake transcripts and commits, then asserts
// all branches: block, allow-on-receipt, allow-on-stop_hook_active, allow-no-work,
// allow-docs-only, allow-unadopted, allow-missing-transcript, and dedup.
// Run: node hooks/land-alert.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./land-alert.mjs', import.meta.url));
// Each test gets its own turn-state dir so dedup state is isolated between cases.
let failures = 0;
let testCount = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'la-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai', 'tickets'), { recursive: true });
  return dir;
}

// Commit a file into the repo. Returns the commit sha.
function makeCommit(dir, filename, content, message) {
  const fullPath = join(dir, filename);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content);
  execFileSync('git', ['add', filename], { cwd: dir });
  execFileSync('git', ['commit', '-m', message, '--allow-empty-message'], { cwd: dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

// Write a fake JSONL transcript. userTs should be BEFORE the commit author time so the
// commit appears "this turn". assistantText is the last assistant message Claude sent.
function writeTranscript(dir, userText, assistantText, userTs) {
  const file = join(dir, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: userText }, timestamp: userTs }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: assistantText }] } }),
  ].join('\n') + '\n');
  return file;
}

function run(dir, payloadObj, turnStateDir) {
  const env = { ...process.env };
  if (turnStateDir) env.CLAUDE_KIT_TURN_STATE = turnStateDir;
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify(payloadObj),
    encoding: 'utf8',
    env,
  });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, actual, wanted) {
  testCount++;
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

// Helper: isolated turn-state dir per test.
function makeTurnStateDir() {
  return mkdtempSync(join(tmpdir(), 'la-ts-'));
}

// ─── case 1: real-work commit this turn + reply does NOT announce → BLOCK (exit 2) ─────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  // User message timestamp well before the commit.
  const userTs = new Date(Date.now() - 10000).toISOString();
  const tx = writeTranscript(d, 'fix the thing', 'Done.', userTs);
  makeCommit(d, 'src/main.ts', 'export {}', 'fix: patch HOD-T001');
  expect('blocks when real-work commit this turn and reply has no receipt',
    run(d, { transcript_path: tx }, tsDir).code, 2);
}

// ─── case 2: reply announces landing AND what to test → ALLOW (exit 0) ───────────────────
// KIT-T088: the gate now needs BOTH a landing receipt AND a test receipt.
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  const sha = makeCommit(d, 'src/app.ts', 'export const x = 1', 'feat: add x HOD-T002');
  const tx = writeTranscript(d, 'push it', `pushed ${sha.slice(0, 8)} — HOD-T002 landed. Test: \`npm test x\`.`, userTs);
  expect('allows when reply announces the push sha + what to test',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 3: reply says "deployed" + a test receipt → ALLOW ──────────────────────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  makeCommit(d, 'src/util.ts', 'export {}', 'chore: update util HOD-T003');
  const tx = writeTranscript(d, 'deploy', 'deployed — HOD-T003 is live. Verify with `npm test`.', userTs);
  expect('allows when reply contains "deployed" + a test receipt',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 3b (KIT-T088): landing announced but NO test receipt → BLOCK (exit 2) ──────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  const sha = makeCommit(d, 'src/app.ts', 'export const y = 2', 'feat: add y HOD-T004');
  const tx = writeTranscript(d, 'push it', `pushed ${sha.slice(0, 8)} — HOD-T004 landed.`, userTs);
  expect('blocks when landing announced but no test receipt',
    run(d, { transcript_path: tx }, tsDir).code, 2);
}

// ─── case 3c (KIT-T088): [no-test: reason] satisfies the test receipt → ALLOW ────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  const sha = makeCommit(d, 'docs.md', '# x', 'docs: notes HOD-T005');
  const tx = writeTranscript(d, 'note', `pushed ${sha.slice(0, 8)} — HOD-T005 landed. [no-test: docs only]`, userTs);
  expect('allows landing + [no-test: reason]',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 4: [no-alert: x] release valve → ALLOW ─────────────────────────────────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  makeCommit(d, 'src/foo.ts', '', 'fix: something HOD-T004');
  const tx = writeTranscript(d, 'do it', 'Done. [no-alert: internal only]', userTs);
  expect('allows [no-alert: reason] release valve',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 5: stop_hook_active: true → ALLOW (loop-proof) ─────────────────────────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  makeCommit(d, 'src/bar.ts', '', 'fix: bar HOD-T005');
  const tx = writeTranscript(d, 'anything', 'Done.', userTs);
  expect('allows when stop_hook_active (loop-proof)',
    run(d, { transcript_path: tx, stop_hook_active: true }, tsDir).code, 0);
}

// ─── case 6: no commit this turn (old commit predates turn start) → ALLOW (silent) ──────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  // Make a commit THEN set userTs AFTER it so the commit's author time < turnStartMs.
  makeCommit(d, 'src/old.ts', '', 'fix: old work HOD-T006');
  // Wait a tiny bit so wall clock advances past the commit.
  const userTs = new Date(Date.now() + 5000).toISOString(); // clearly future of the commit
  const tx = writeTranscript(d, 'nothing new', 'Nothing happened this turn.', userTs);
  expect('allows when no commit happened this turn',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 7: docs-only, un-cited commit → ALLOW (noise, not real work) ──────────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  // A .md file commit with no ticket id in the subject — docs noise.
  makeCommit(d, 'docs/notes.md', '# notes', 'update docs notes');
  const tx = writeTranscript(d, 'update docs', 'Updated the docs.', userTs);
  expect('allows docs-only un-cited commit (not real work)',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 8: unadopted repo (no .ai/) → ALLOW ────────────────────────────────────────────
{
  const d = makeRepo({ adopt: false });
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  makeCommit(d, 'main.ts', 'export {}', 'fix: something HOD-T008');
  const tx = writeTranscript(d, 'push', 'Done.', userTs);
  expect('allows on unadopted repo (no .ai/)',
    run(d, { transcript_path: tx }, tsDir).code, 0);
}

// ─── case 9: missing transcript → ALLOW (fail-open) ──────────────────────────────────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  makeCommit(d, 'src/x.ts', '', 'fix: x HOD-T009');
  expect('allows on missing transcript (fail-open)',
    run(d, { transcript_path: join(d, 'nope.jsonl') }, tsDir).code, 0);
}

// ─── case 10: DEDUP — same HEAD + pushed state fires once, second spawn is silent ─────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  makeCommit(d, 'src/dup.ts', '', 'fix: dedup HOD-T010');
  const tx = writeTranscript(d, 'go', 'Done.', userTs);
  // First spawn: should BLOCK (exit 2) + record the marker.
  const r1 = run(d, { transcript_path: tx }, tsDir);
  // Second spawn against same repo state (same HEAD, same pushed=false, same reply):
  // marker already set → should be SILENT (exit 0).
  const tx2 = writeTranscript(d, 'go again', 'Still done.', userTs);
  const r2 = run(d, { transcript_path: tx2 }, tsDir);
  expect('dedup first call blocks (exit 2)', r1.code, 2);
  expect('dedup second call is silent (exit 0)', r2.code, 0);
}

// ─── case 11: ticket-id citation in subject (no code file) → real work → BLOCK ──────────
{
  const d = makeRepo();
  const tsDir = makeTurnStateDir();
  const userTs = new Date(Date.now() - 10000).toISOString();
  // Only touches a .md file BUT cites a ticket id — counts as real work.
  makeCommit(d, '.ai/tickets/KIT-T011.md', '---\nid: KIT-T011\n---\n', 'update plan KIT-T011');
  const tx = writeTranscript(d, 'update ticket', 'Updated the plan.', userTs);
  expect('blocks when commit cites a ticket id (even md-only file)',
    run(d, { transcript_path: tx }, tsDir).code, 2);
}

console.log(`\n${testCount} tests — ${failures ? `${failures} FAILED` : 'ALL PASS'}`);
process.exit(failures ? 1 : 0);
