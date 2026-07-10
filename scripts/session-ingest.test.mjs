#!/usr/bin/env node
// Tests for session-ingest.mjs + q-sessions.mjs (KIT-T100) — synthetic Claude Code
// transcripts in a temp projects dir, ingested into a temp sessions.db, then queried.
// Engine-dependent assertions SKIP (not fail) when no SQLite engine exists — the cache
// is optional by design (KIT-T004); the parser tests always run. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ingestSessions, listTranscripts, openSessionsDb, parseTranscript } from './session-ingest.mjs';
import { runSessions } from './q-sessions.mjs';

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

const jl = (objs) => objs.map((o) => JSON.stringify(o)).join('\n') + '\n';
const T0 = '2026-07-09T15:00:00.000Z';
const T1 = '2026-07-09T15:01:00.000Z';
const T2 = '2026-07-09T15:02:00.000Z';

const root = mkdtempSync(join(tmpdir(), 'kit-sessions-'));
const projDir = join(root, 'projects', 'D--dev-testproj');
mkdirSync(projDir, { recursive: true });
const dbPath = join(root, 'sessions.db');
const projectsRoot = join(root, 'projects');

// A transcript with every shape the parser must survive: meta lines, hook noise,
// sidechain messages, command-caveat user lines, array-part assistant content, a
// malformed line — and two real exchanges.
const SESSION_A = 'aaaaaaaa-1111-2222-3333-444444444444';
writeFileSync(join(projDir, `${SESSION_A}.jsonl`), jl([
  { type: 'mode', mode: 'normal', sessionId: SESSION_A },
  { type: 'file-history-snapshot', snapshot: { timestamp: T0 } },
  { type: 'user', timestamp: T0, message: { role: 'user', content: 'fix the ribbon parity bug' } },
  { type: 'user', timestamp: T0, message: { role: 'user', content: '<local-command-caveat>noise</local-command-caveat>' } },
  { type: 'user', timestamp: T0, message: { role: 'user', content: '<system-reminder>injected</system-reminder>' } },
  { type: 'assistant', timestamp: T1, message: { role: 'assistant', content: [{ type: 'text', text: 'ribbons survive chunking' }, { type: 'tool_use', name: 'Bash' }] } },
  { type: 'user', timestamp: T1, isSidechain: true, message: { role: 'user', content: 'subagent internals' } },
  { type: 'assistant', timestamp: T2, message: { role: 'assistant', content: [{ type: 'text', text: 'done — 31368 tris' }] } },
]) + 'NOT JSON AT ALL\n');

const SESSION_B = 'bbbbbbbb-1111-2222-3333-444444444444';
writeFileSync(join(projDir, `${SESSION_B}.jsonl`), jl([
  { type: 'user', timestamp: T2, message: { role: 'user', content: 'terrace hole cut question' } },
  { type: 'assistant', timestamp: T2, message: { role: 'assistant', content: 'holes only under whole tiles' } },
]));

// ---- parser (engine-free) ----
{
  const s = parseTranscript(join(projDir, `${SESSION_A}.jsonl`), 'D--dev-testproj');
  ok('parses kept messages only (noise/sidechain/meta dropped)', s.messages.length === 3);
  ok('label = first real user prompt', s.label === 'fix the ribbon parity bug');
  ok('started/ended span all stamped lines', s.started === T0 && s.ended === T2);
  ok('assistant array content flattens to text', s.messages[1].text === 'ribbons survive chunking');
  ok('malformed trailing line is survived', s.id === SESSION_A);
  ok('listTranscripts finds both sessions', listTranscripts(projectsRoot).length === 2);
}

// ---- ingest + queries (engine-dependent) ----
const db = await openSessionsDb(dbPath);
if (!db) {
  console.log('  skip  no SQLite engine — ingest/query tests skipped (cache is optional)');
} else {
  db.close();
  const first = await ingestSessions({ dbPath, root: projectsRoot });
  ok('first ingest reads both transcripts', first.ingested === 2 && first.failed === 0);
  const second = await ingestSessions({ dbPath, root: projectsRoot });
  ok('unchanged transcripts skip on re-ingest', second.ingested === 0 && second.skipped === 2);

  // Appending to a transcript re-ingests exactly that one file.
  const aPath = join(projDir, `${SESSION_A}.jsonl`);
  writeFileSync(aPath, jl([
    { type: 'user', timestamp: '2026-07-09T15:03:00.000Z', message: { role: 'user', content: 'and the seam parity?' } },
  ]), { flag: 'a' });
  utimesSync(aPath, new Date(), new Date());
  const third = await ingestSessions({ dbPath, root: projectsRoot });
  ok('appended transcript re-ingests alone', third.ingested === 1 && third.skipped === 1);

  const db2 = await openSessionsDb(dbPath);
  const sessions = db2.all('SELECT id, label, n_messages FROM sessions ORDER BY id');
  ok('sessions table holds both', sessions.length === 2 && sessions[0].n_messages === 4);
  const hits = db2.all(
    "SELECT session_id FROM messages_fts WHERE messages_fts MATCH '\"ribbon\" \"parity\"'");
  ok('FTS finds the exchange', hits.length >= 1 && hits[0].session_id === SESSION_A);
  const stale = db2.all('SELECT COUNT(*) AS n FROM messages WHERE session_id = ?', [SESSION_A]);
  ok('re-ingest replaced, not duplicated', stale[0].n === 4);
  db2.close();

  // The q surface end-to-end (stdout captured; temp db + temp transcripts, never the real ones).
  const grab = async (cmd, args) => {
    let out = '';
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (s) => { out += s; return true; };
    try { await runSessions(cmd, args, { json: false, dbPath, root: projectsRoot }); } finally { process.stdout.write = orig; }
    return out;
  };
  const dump = await grab('session', [SESSION_B.slice(0, 8)]);
  ok('q session dumps timestamped lines', /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\] you: terrace hole cut question/.test(dump));
}

rmSync(root, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
