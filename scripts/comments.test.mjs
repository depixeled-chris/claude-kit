#!/usr/bin/env node
// Tests for the comment / @mention / read-receipt model (KIT-T130). Builds throwaway .ai
// fixtures and drives the EXPORTED functions directly, plus one CLI integration case that
// shells the real t.mjs + q.mjs to prove comment append -> mention derivation -> ack ->
// unread-clears end to end. exit 0 = all pass. Same hand-rolled harness as t.test.mjs.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {
  deriveMentions, buildComment, parseComments, buildRef,
  readReceipts, recordAck, isAcked, mentionsForAgent, collectComments, resolveAgent,
} from './comments.mjs';
import { comment, ack } from './t.mjs';
import { query } from './q.mjs';

const T_CLI = fileURLToPath(import.meta.url).replace(/comments\.test\.mjs$/, 't.mjs');
const Q_CLI = fileURLToPath(import.meta.url).replace(/comments\.test\.mjs$/, 'q.mjs');
let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}
function threw(fn) {
  try { fn(); return false; } catch { return true; }
}

const CONFIG = `classifications:
  feature: { routes_to: backlog }
statuses:
  flow: [todo, doing, review, done]
  human_only: []
  off_board: [superseded]
uat:
  default: none
history:
  archive_done_to: tickets/archive
  events: [created, status, comment, decision, blocker, unblocked, fixed, regressed]
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

const ticketDoc = (id) => `---
id: ${id}
title: seed ${id}
type: feature
status: doing
priority: high
links: []
supersedes:
superseded_by:
---

## Description
seed.

## Acceptance Criteria
- [ ] first criterion

## Notes

## History
`;

function project(ids = ['KIT-T001']) {
  const d = mkdtempSync(join(tmpdir(), 'kit-cmt-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), CONFIG);
  for (const id of ids) writeFileSync(join(d, '.ai', 'tickets', `${id}-seed.md`), ticketDoc(id));
  return d;
}
const read = (root, id) => readFileSync(join(root, '.ai', 'tickets', `${id}-seed.md`), 'utf8');

// --- deriveMentions ---
ok('mentions: derives @handles from text', JSON.stringify(deriveMentions('hi @bob and @alice-2')) === JSON.stringify(['bob', 'alice-2']));
ok('mentions: dedups repeats', JSON.stringify(deriveMentions('@bob @bob')) === JSON.stringify(['bob']));
ok('mentions: none in plain text', deriveMentions('no handles here').length === 0);

// --- buildComment / parseComments: single-line ---
const b1 = buildComment('## History\n', { id: 'KIT-T001', author: 'user', text: 'ping @bob please', ts: '2026-07-23 10:00' });
ok('build: single-line stays inline (no Notes spill)', b1.notesBlock === null && /\(comment\) @user: ping @bob please/.test(b1.historyLine));
ok('build: ordinal 1 on an empty ticket', b1.ordinal === 1 && b1.ref === 'KIT-T001#1');
ok('build: mentions exclude the author, include the body handle', JSON.stringify(b1.mentions) === JSON.stringify(['bob']));

// --- buildComment / parseComments: multi-line spills to Notes, mentions reconstructed ---
const longText = 'summary line\n@carol review the detail\nmore prose';
const b2 = buildComment('## History\n', { id: 'KIT-T001', author: 'user', text: longText, ts: '2026-07-23 10:01' });
ok('build: multi-line spills to a Notes block', !!b2.notesBlock && /full comment #1 in ## Notes/.test(b2.historyLine));
ok('build: spilled Notes block carries the full body', /@carol review the detail/.test(b2.notesBlock));
ok('build: mentions derived from the FULL (spilled) body', b2.mentions.includes('carol'));

// --- parseComments over a real appended ticket (via t.comment) ---
const pc = project();
comment(pc, 'KIT-T001', 'first @bob', { author: 'user' });
comment(pc, 'KIT-T001', 'second @dave', { author: 'ann' });
const parsed = parseComments(read(pc, 'KIT-T001'));
ok('parse: counts both authored comments, in order', parsed.length === 2 && parsed[0].ordinal === 1 && parsed[1].ordinal === 2);
ok('parse: reads author + mentions per comment', parsed[0].author === 'user' && parsed[1].mentions.includes('dave'));

// --- comment(): appends History event, ignores tick/status (comment) noise ---
ok('comment: History (comment) event appended to the ticket file', /\(comment\) @user: first @bob/.test(read(pc, 'KIT-T001')));
ok('comment: rejects a blank author', threw(() => comment(pc, 'KIT-T001', 'x', { author: '  ' })));
ok('comment: rejects empty text', threw(() => comment(pc, 'KIT-T001', '   ', { author: 'user' })));
ok('comment: rejects an unknown id', threw(() => comment(pc, 'KIT-T999', 'x', { author: 'user' })));

// A multi-line comment routes prose to ## Notes.
const ml = project();
const mlRes = comment(ml, 'KIT-T001', 'head line\n@zed look here\ntail', { author: 'user' });
ok('comment: multi-line body spilled to Notes', mlRes.spilled === true && /### comment #1/.test(read(ml, 'KIT-T001')));
ok('comment: spilled comment still derives its mention', mlRes.mentions.includes('zed'));

// --- ack lifecycle (store) ---
const ackRoot = project();
comment(ackRoot, 'KIT-T001', 'review this @bob', { author: 'user' });
ok('receipts: empty before any ack', readReceipts(ackRoot).acks.length === 0);
const acked = ack(ackRoot, 'KIT-T001#1', { agent: 'bob' });
ok('ack: records a receipt for the agent', acked.ref === 'KIT-T001#1' && acked.already === false);
ok('ack: isAcked true after acking', isAcked(readReceipts(ackRoot), 'KIT-T001#1', 'bob'));
ok('ack: a different agent has NOT acked', !isAcked(readReceipts(ackRoot), 'KIT-T001#1', 'alice'));
ok('ack: re-acking is idempotent (already)', ack(ackRoot, 'KIT-T001#1', { agent: 'bob' }).already === true);
ok('ack: rejects a malformed reference', threw(() => ack(ackRoot, 'KIT-T001', { agent: 'bob' })));
ok('ack: rejects a non-existent comment ordinal', threw(() => ack(ackRoot, 'KIT-T001#9', { agent: 'bob' })));
ok('ack: rejects a blank agent', threw(() => ack(ackRoot, 'KIT-T001#1', { agent: '' })));

// --- mentionsForAgent + collectComments: unread vs read ---
const items = [{ id: 'KIT-T001', store: 'tickets', body: '## History\n- [2026-07-23 10:00] (comment) @user: hey @bob and @amy\n' }];
ok('collectComments: one comment, store-wide ref', collectComments(items).length === 1 && collectComments(items)[0].ref === buildRef('KIT-T001', 1));
const noAcks = { version: 1, acks: [] };
ok('mentionsForAgent: unread when un-acked', mentionsForAgent(items, noAcks, 'bob').every((m) => m.acked === false) && mentionsForAgent(items, noAcks, 'bob').length === 1);
ok('mentionsForAgent: case-insensitive match', mentionsForAgent(items, noAcks, 'AMY').length === 1);
ok('mentionsForAgent: no match for an unmentioned agent', mentionsForAgent(items, noAcks, 'nobody').length === 0);
const withAck = { version: 1, acks: [{ ref: 'KIT-T001#1', agent: 'bob' }] };
ok('mentionsForAgent: acked marks read (surfacing filters it out)', mentionsForAgent(items, withAck, 'bob')[0].acked === true);

// --- resolveAgent identity ---
ok('resolveAgent: defaults to claude', resolveAgent({}) === 'claude');
ok('resolveAgent: KIT_AGENT wins', resolveAgent({ KIT_AGENT: 'opus' }) === 'opus');

// --- q mentions (in-process) unread -> ack -> read ---
const qr = project();
comment(qr, 'KIT-T001', 'can you look @bob', { author: 'user' });
const before = await query('mentions', ['bob'], { cwdRoot: qr });
ok('q mentions: surfaces the unread mention', before.rows.length === 1 && before.rows[0].state === 'unread' && before.rows[0].ref === 'KIT-T001#1');
ack(qr, 'KIT-T001#1', { agent: 'bob' });
const after = await query('mentions', ['bob'], { cwdRoot: qr });
ok('q mentions: mention reads as acked after ack (stops surfacing as unread)', after.rows.length === 1 && after.rows[0].state === 'read');

// --- CLI integration: real t.mjs comment + ack, real q.mjs mentions ---
const cli = project();
try {
  execFileSync('node', [T_CLI, 'comment', 'KIT-T001', 'CLI ping @bob', '--author', 'user', '--root', cli], { stdio: 'pipe' });
  const listed = JSON.parse(execFileSync('node', [Q_CLI, '--json', '--no-db', 'mentions', 'bob', '--root', cli], { stdio: 'pipe' }).toString());
  const unreadOk = listed.length === 1 && listed[0].state === 'unread' && listed[0].ref === 'KIT-T001#1';
  execFileSync('node', [T_CLI, 'ack', 'KIT-T001#1', '--agent', 'bob', '--root', cli], { stdio: 'pipe' });
  const relisted = JSON.parse(execFileSync('node', [Q_CLI, '--json', '--no-db', 'mentions', 'bob', '--root', cli], { stdio: 'pipe' }).toString());
  ok('CLI: comment -> q mentions (unread) -> ack -> q mentions (read)', unreadOk && relisted[0].state === 'read');
} catch (e) {
  ok('CLI: comment -> q mentions (unread) -> ack -> q mentions (read)', false);
  console.log('     ' + (e.stderr ? e.stderr.toString().split('\n')[0] : e.message));
}

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\ncomments: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
