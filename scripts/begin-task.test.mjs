#!/usr/bin/env node
// Tests for begin-task.mjs + end-task.mjs (KIT-T029). Builds throwaway .ai fixtures in
// a temp dir and shells the real CLIs — these are integration tests, not unit tests,
// because the value is the CLI surface: correct exit codes, shape of JSON output,
// graceful failure on a missing id, and the status+note roundtrip. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const BEGIN = resolve(SCRIPT_DIR, 'begin-task.mjs');
const END = resolve(SCRIPT_DIR, 'end-task.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// Run a script, returning { stdout, stderr, status }. Never throws.
function run(script, args, opts = {}) {
  const r = spawnSync('node', [script, ...args], {
    encoding: 'utf8',
    cwd: opts.cwd || process.cwd(),
    env: { ...process.env, ...opts.env },
  });
  return { stdout: r.stdout || '', stderr: r.stderr || '', status: r.status ?? 1 };
}

// ---- fixture helpers --------------------------------------------------------------------

const CONFIG = `classifications:
  feature: { routes_to: backlog }
  bug:     { routes_to: tickets }
statuses:
  flow: [todo, doing, review, done]
  human_only: []
  off_board: [superseded]
uat:
  default: none
history:
  archive_done_to: tickets/archive
ids:
  key: "KIT"
  prefix: "KIT-T"
  pad: 3
`;

function ticketDoc(id, { type = 'feature', status = 'todo', links = '' } = {}) {
  return `---
id: ${id}
title: Test ticket ${id}
type: ${type}
status: ${status}
priority: high
${links ? `links: [${links}]\n` : 'links: []\n'}supersedes:
superseded_by:
---

## Description
A seeded test ticket for begin-task / end-task integration tests.

## Acceptance Criteria
- [ ] first open criterion
- [x] already satisfied criterion
- [ ] second open criterion

## Notes
Some notes text from prior sessions.

## History
- [2026-01-01 00:00] (created) feature — Test ticket ${id}
`;
}

function project(tickets = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-bt-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), CONFIG);
  for (const [id, opts] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', `${id}-seed.md`), ticketDoc(id, opts));
  }
  return d;
}

// ---- begin-task: JSON shape -----------------------------------------------------------

const bt1 = project({ 'KIT-T001': {} });
const r1 = run(BEGIN, ['KIT-T001', '--root', bt1]);
ok('begin-task: exits 0', r1.status === 0);

let packet;
try { packet = JSON.parse(r1.stdout); } catch { packet = null; }
ok('begin-task: emits valid JSON by default', packet !== null);
ok('begin-task: packet.id matches', packet && packet.id === 'KIT-T001');
ok('begin-task: packet.meta.title present', packet && typeof packet.meta.title === 'string' && packet.meta.title.length > 0);
ok('begin-task: packet.meta.status present', packet && typeof packet.meta.status === 'string');
ok('begin-task: packet.description present', packet && typeof packet.description === 'string');
ok('begin-task: packet.criteria is an array', packet && Array.isArray(packet.criteria));
ok('begin-task: only OPEN criteria included (2 open, 1 checked)', packet && packet.criteria.length === 2);
ok('begin-task: checked criterion excluded', packet && !packet.criteria.some((c) => /already satisfied/.test(c)));
ok('begin-task: packet.notes present', packet && typeof packet.notes === 'string');
ok('begin-task: packet.trail is an array', packet && Array.isArray(packet.trail));
ok('begin-task: packet.history is an array', packet && Array.isArray(packet.history));

// ---- begin-task: --md output -----------------------------------------------------------

const r1md = run(BEGIN, ['KIT-T001', '--md', '--root', bt1]);
ok('begin-task --md: exits 0', r1md.status === 0);
ok('begin-task --md: emits markdown heading', /^#\s+Handoff brief:/m.test(r1md.stdout));
ok('begin-task --md: includes acceptance criteria section', /## Open Acceptance Criteria/.test(r1md.stdout));
ok('begin-task --md: includes open criteria lines', /- \[ \] first open criterion/.test(r1md.stdout));
ok('begin-task --md: excludes checked criteria', !/already satisfied/.test(r1md.stdout));
ok('begin-task --md: is NOT valid JSON (is markdown)', (() => { try { JSON.parse(r1md.stdout); return false; } catch { return true; } })());

// ---- begin-task: fail-open on unknown id -----------------------------------------------

const r1bad = run(BEGIN, ['KIT-T999', '--root', bt1]);
ok('begin-task: exits non-zero on unknown id', r1bad.status !== 0);
ok('begin-task: error message mentions the id', /KIT-T999/.test(r1bad.stderr));

// ---- begin-task: missing id argument ---------------------------------------------------

const r1noarg = run(BEGIN, ['--root', bt1]);
ok('begin-task: exits non-zero with no id arg', r1noarg.status !== 0);

// ---- end-task: status transition -------------------------------------------------------

const et1 = project({ 'KIT-T010': { status: 'todo' } });
const re1 = run(END, ['KIT-T010', 'doing', '--root', et1]);
ok('end-task: exits 0 on valid transition', re1.status === 0);

// Read the file back to verify the transition actually happened.
const ticketText = readFileSync(join(et1, '.ai', 'tickets', 'KIT-T010-seed.md'), 'utf8');
ok('end-task: status updated in file', /status: doing/.test(ticketText));
ok('end-task: History line appended', /\(status\) todo → doing/.test(ticketText));

// ---- end-task: --note appends a History comment ----------------------------------------

const et2 = project({ 'KIT-T020': { status: 'todo' } });
const re2 = run(END, ['KIT-T020', 'doing', '--note', 'handoff context assembled', '--root', et2]);
ok('end-task: exits 0 with --note', re2.status === 0);

const noteText = readFileSync(join(et2, '.ai', 'tickets', 'KIT-T020-seed.md'), 'utf8');
ok('end-task: --note appended under History', /\(comment\) handoff context assembled/.test(noteText));

// ---- end-task: fail on unknown id -------------------------------------------------------

const et3 = project({ 'KIT-T030': {} });
const re3 = run(END, ['KIT-T999', 'doing', '--root', et3]);
ok('end-task: exits non-zero on unknown id', re3.status !== 0);

// ---- end-task: fail on missing args -----------------------------------------------------

const re4 = run(END, ['KIT-T030', '--root', et3]);
ok('end-task: exits non-zero when status arg missing', re4.status !== 0);

// ---- cleanup + result ----------------------------------------------------------------

for (const d of fixtures) {
  try { execFileSync('node', ['-e', `require('fs').rmSync(${JSON.stringify(d)}, {recursive:true,force:true})`]); } catch { /* best-effort */ }
}

console.log('');
console.log(`begin-task / end-task: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
