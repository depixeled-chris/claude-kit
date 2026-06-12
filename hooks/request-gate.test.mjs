// Automated test for the request-capture ratchet (hooks/request-gate.mjs).
// Spins up throwaway adopted repos + fake transcripts and asserts the gate's
// branches: block on un-captured request, allow on receipt/capture/no-signal/
// stop_hook_active/missing-transcript/unadopted. Run: node hooks/request-gate.test.mjs

import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./request-gate.mjs', import.meta.url));
const STORES = ['inbox', 'tickets', 'decisions', 'questions', 'notes'];
let failures = 0;

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rg-'));
  execFileSync('git', ['init', '-q'], { cwd: dir });
  if (adopt) for (const s of STORES) mkdirSync(join(dir, '.ai', s), { recursive: true });
  return dir;
}

function writeTranscript(dir, userText, assistantText, userTs = '2026-01-01T00:00:00.000Z') {
  const file = join(dir, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: userText }, timestamp: userTs }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: assistantText }] } }),
  ].join('\n') + '\n');
  return file;
}

function run(dir, payload) {
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, input: JSON.stringify(payload), encoding: 'utf8' });
  return { code: r.status, err: r.stderr || '' };
}

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (exit=${actual}, want=${wanted})`);
  if (!ok) failures++;
}

// 1. request signal + no receipt + empty stores -> BLOCK (exit 2)
{
  const d = makeRepo();
  const tx = writeTranscript(d, "I'd like a command to do that in the future", 'Sure, here is the answer.', new Date().toISOString());
  expect('blocks un-captured request', run(d, { transcript_path: tx }).code, 2);
}
// 2. request signal + receipt token in reply -> ALLOW
{
  const d = makeRepo();
  const tx = writeTranscript(d, 'can you add a questionnaire command', '→ KIT-T009 filed (todo). Done.', new Date().toISOString());
  expect('allows when reply has a receipt', run(d, { transcript_path: tx }).code, 0);
}
// 3. request signal + [no-capture] dismissal -> ALLOW
{
  const d = makeRepo();
  const tx = writeTranscript(d, 'we should eventually refactor this', 'Handled inline. [no-capture: done this turn]', new Date().toISOString());
  expect('allows on [no-capture]', run(d, { transcript_path: tx }).code, 0);
}
// 4. no request signal -> ALLOW
{
  const d = makeRepo();
  const tx = writeTranscript(d, 'what does this function do?', 'It clamps the value.', new Date().toISOString());
  expect('allows non-request message', run(d, { transcript_path: tx }).code, 0);
}
// 5. signal but something captured to a store this turn -> ALLOW
{
  const d = makeRepo();
  writeFileSync(join(d, '.ai', 'inbox', '2026-06-03-1200-thing.md'), '(idea) something');
  const tx = writeTranscript(d, "I'd like X in the future", 'Logged it.', '2026-06-03T00:00:00.000Z');
  expect('allows when a store file was just written', run(d, { transcript_path: tx }).code, 0);
}
// 6. stop_hook_active -> ALLOW (loop-proof)
{
  const d = makeRepo();
  const tx = writeTranscript(d, "I'd like a new feature", 'no receipt here', new Date().toISOString());
  expect('allows when stop_hook_active (no loop)', run(d, { transcript_path: tx, stop_hook_active: true }).code, 0);
}
// 7. missing transcript -> ALLOW (fail-open)
{
  const d = makeRepo();
  expect('allows on missing transcript', run(d, { transcript_path: join(d, 'nope.jsonl') }).code, 0);
}
// 8. unadopted repo (no .ai) -> ALLOW
{
  const d = makeRepo({ adopt: false });
  const tx = writeTranscript(d, "I'd like a thing in the future", 'no receipt', new Date().toISOString());
  expect('no-ops on unadopted repo', run(d, { transcript_path: tx }).code, 0);
}

// 9. blunt bug-report request (no polite phrasing) -> BLOCK
{
  const d = makeRepo();
  const tx = writeTranscript(d, "The moon shouldn't be a glowball on a clear day", 'Adjusted.', new Date().toISOString());
  expect('blocks a blunt bug-report ("shouldn\'t be")', run(d, { transcript_path: tx }).code, 2);
}
// 10. blunt "there needs to be" -> BLOCK
{
  const d = makeRepo();
  const tx = writeTranscript(d, 'There needs to be a wider street', 'ok', new Date().toISOString());
  expect('blocks "there needs to be"', run(d, { transcript_path: tx }).code, 2);
}
// 11. "doesn't feel" + only a TICKET edited this turn (not inbox) -> BLOCK (valve is inbox-only)
{
  const d = makeRepo();
  writeFileSync(join(d, '.ai', 'tickets', 'HOD-T001-x.md'), '---\nid: HOD-T001\n---\nedited');
  const tx = writeTranscript(d, "200MPH doesn't feel like 200MPH", 'tuned the FOV', '2026-06-03T00:00:00.000Z');
  expect('a ticket edit does NOT release the valve', run(d, { transcript_path: tx }).code, 2);
}
// 12. plain question -> ALLOW (no over-match on the broadened signals)
{
  const d = makeRepo();
  const tx = writeTranscript(d, 'how does the streaming ring work?', 'It loads chunks around the player.', new Date().toISOString());
  expect('allows a plain how/what question', run(d, { transcript_path: tx }).code, 0);
}

// 13. a harness task-notification (request-shaped) is NOT a user request -> ALLOW
{
  const d = makeRepo();
  const note = '<task-notification>\n<task-id>abc</task-id>\nresult: the thing does not work and we should fix it.\n</task-notification>';
  const tx = writeTranscript(d, note, 'Reviewed and committed.', new Date().toISOString());
  expect('ignores a task-notification as a request', run(d, { transcript_path: tx }).code, 0);
}
// 14. a real request is still caught when a task-notification arrives AFTER it
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'There needs to be a wider street' }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: '<task-notification>\n<task-id>z</task-id>\nresult: should look fine now\n</task-notification>' }, timestamp: new Date().toISOString() }),
  ].join('\n') + '\n');
  expect('still blocks the real request behind a later notification', run(d, { transcript_path: file }).code, 2);
}

// 15. a skill/slash-command prompt (isMeta:true, request-shaped) is NOT a user request -> ALLOW
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', isMeta: true, sourceToolUseID: 'toolu_x',
      message: { role: 'user', content: [{ type: 'text', text: 'Classify and route the following per the contract. We should add a wider street.' }] },
      timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Routed it.' }] } }),
  ].join('\n') + '\n');
  expect('ignores a skill prompt (isMeta) as a request', run(d, { transcript_path: file }).code, 0);
}
// 16. a real request is still caught when an isMeta skill prompt arrives AFTER it
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'There needs to be a wider street' }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } }),
    JSON.stringify({ type: 'user', isMeta: true, sourceToolUseID: 'toolu_y',
      message: { role: 'user', content: [{ type: 'text', text: 'Read-only standup. Run the survey and show it.' }] },
      timestamp: new Date().toISOString() }),
  ].join('\n') + '\n');
  expect('still blocks the real request behind a later skill prompt', run(d, { transcript_path: file }).code, 2);
}

// 17. a harness COMPACTION summary (isCompactSummary, request-shaped) is NOT a request -> ALLOW
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  const summary = 'This session is being continued from a previous conversation that ran out of '
    + 'context. The summary below covers the earlier portion. We should add a wider street and '
    + 'fix the moon. There needs to be a command for that.';
  writeFileSync(file, [
    JSON.stringify({ type: 'user', isCompactSummary: true, isVisibleInTranscriptOnly: true,
      message: { role: 'user', content: summary }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Resuming the work.' }] } }),
  ].join('\n') + '\n');
  expect('ignores a compaction summary as a request', run(d, { transcript_path: file }).code, 0);
}
// 18. the SAME, but the structural flag is absent — the preamble fail-safe still catches it -> ALLOW
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  const summary = 'This session is being continued from a previous conversation that ran out of '
    + 'context. We should add a wider street.';
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: summary }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } }),
  ].join('\n') + '\n');
  expect('preamble fail-safe catches an unflagged summary', run(d, { transcript_path: file }).code, 0);
}
// 19. a genuine request typed AFTER the resume is STILL flagged (filter is scoped to the summary,
//     not the resumed turn — criterion 2) -> BLOCK
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  const summary = 'This session is being continued from a previous conversation that ran out of context.';
  writeFileSync(file, [
    JSON.stringify({ type: 'user', isCompactSummary: true, message: { role: 'user', content: summary }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Resumed.' }] } }),
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'There needs to be a wider street' }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'ok' }] } }),
  ].join('\n') + '\n');
  expect('still blocks a real request typed after the resume', run(d, { transcript_path: file }).code, 2);
}
// 20. a pre-compaction request BEFORE the summary is NOT resurrected (the summary is the turn
//     boundary; that request was already handled in its own turn) -> ALLOW
{
  const d = makeRepo();
  const file = join(d, 'transcript.jsonl');
  const summary = 'This session is being continued from a previous conversation that ran out of context.';
  writeFileSync(file, [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'There needs to be a wider street' }, timestamp: '2026-01-01T00:00:00.000Z' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Done, → KIT-T999 filed.' }] } }),
    JSON.stringify({ type: 'user', isCompactSummary: true, message: { role: 'user', content: summary }, timestamp: new Date().toISOString() }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Resumed.' }] } }),
  ].join('\n') + '\n');
  expect('does not resurrect a pre-compaction request', run(d, { transcript_path: file }).code, 0);
}

console.log(failures ? `\n${failures} FAILED` : '\nALL PASS');
process.exit(failures ? 1 : 0);
