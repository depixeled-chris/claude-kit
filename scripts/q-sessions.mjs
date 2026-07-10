#!/usr/bin/env node
// q-sessions.mjs — the `q sessions | session | said` surface over sessions.db (KIT-T100).
// Sessions are CONVERSATION history (machine-local, derived from Claude Code's own
// transcripts); work items stay in workflow.db — same `q` front door, separate file, so
// the 750 MB-scale transcript ingest never rides the work cache's rebuild lifecycle.
//
// LAZY INGEST: every command refreshes the cache incrementally first (changed transcripts
// only — milliseconds when nothing changed). Multiple terminals querying at once queue on
// WAL for the rare write; a locked ingest fails open and the next query repairs.
//
// NO-ENGINE FALLBACK: `sessions` lists transcripts by file stat and `session` parses the
// one file directly; `said` genuinely needs FTS and says so instead of scanning 750 MB.
//
//   q sessions [--project <substr>] [--limit N]   list sessions, newest first
//   q session <id-prefix>                          timestamped conversation dump
//   q said <words...> [--project <substr>]         full-text search across all sessions

import { basename } from 'node:path';
import {
  ingestSessions, listTranscripts, openSessionsDb, parseTranscript, sessionsDbPath, transcriptsRoot,
} from './session-ingest.mjs';

const LIST_LIMIT = 30;   // sessions shown by default — a screenful, not an archive dump
const HIT_LIMIT = 25;    // said hits — a retrieval list, not a full dump (mirrors q fts)
const SNIPPET_TOKENS = 8;
const SNIPPET_COL = 0;   // messages_fts column 0 = text
const ID_SHORT = 8;      // enough of a uuid to be unique and readable

const SESSION_COLS = 'id, project, file, started, ended, label, n_messages';

const pad2 = (n) => String(n).padStart(2, '0');
/** ISO UTC → compact LOCAL stamp — the whole point is "when was this said, my clock". */
function local(iso, withDate = true) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return withDate ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hm}` : hm;
}

/** Barewords ANDed — precision search, and no way to inject FTS MATCH syntax. */
function ftsAndQuery(text) {
  const terms = String(text || '').toLowerCase().match(/[a-z\d][a-z\d]*/g) || [];
  return terms.length ? terms.map((t) => `"${t}"`).join(' ') : '""';
}

function takeFlag(args, name) {
  const i = args.indexOf(name);
  if (i < 0) return { args, value: undefined };
  const value = args[i + 1];
  return { args: args.filter((_, k) => k !== i && k !== i + 1), value };
}

const speaker = (role) => (role === 'user' ? 'you' : 'claude');

function printSession(s, messages, json) {
  if (json) {
    process.stdout.write(JSON.stringify({ ...s, messages }, null, 2) + '\n');
    return;
  }
  process.stdout.write(`session ${s.id}\n${s.project}  ${local(s.started)} → ${local(s.ended)}  (${messages.length} messages)\n\n`);
  for (const m of messages) {
    const text = m.text.includes('\n') ? m.text.replace(/\n/g, '\n    ') : m.text;
    process.stdout.write(`[${local(m.ts)}] ${speaker(m.role)}: ${text}\n`);
  }
}

async function noEngineFallback(cmd, args, json, root = transcriptsRoot()) {
  if (cmd === 'sessions') {
    const rows = listTranscripts(root)
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, LIST_LIMIT)
      .map((t) => ({ id: basename(t.path, '.jsonl'), project: t.project, modified: new Date(t.mtime).toISOString() }));
    process.stdout.write(json ? JSON.stringify(rows, null, 2) + '\n'
      : rows.map((r) => `${local(r.modified)}  ${r.project}  ${r.id.slice(0, ID_SHORT)}`).join('\n') + '\n');
    return 0;
  }
  if (cmd === 'session') {
    const prefix = args[0] || '';
    const hit = listTranscripts(root).find((t) => basename(t.path, '.jsonl').startsWith(prefix));
    if (!hit) { process.stderr.write(`q session: no transcript matches '${prefix}'\n`); return 1; }
    const s = parseTranscript(hit.path, hit.project);
    printSession(s, s.messages, json);
    return 0;
  }
  process.stderr.write('q said: full-text search needs a SQLite engine (none found).\n');
  return 1;
}

/** `dbPath`/`root` override the real cache + transcripts dir (tests); defaults in prod. */
export async function runSessions(cmd, rawArgs, { json = false, dbPath, root } = {}) {
  let { args, value: project } = takeFlag(rawArgs, '--project');
  const lim = takeFlag(args, '--limit');
  args = lim.args;
  const limit = Number(lim.value) > 0 ? Number(lim.value) : (cmd === 'said' ? HIT_LIMIT : LIST_LIMIT);

  const ingest = await ingestSessions({ dbPath, root });
  if (ingest.error === 'no-engine') return noEngineFallback(cmd, args, json, root);

  const db = await openSessionsDb(dbPath ?? sessionsDbPath());
  if (!db) return noEngineFallback(cmd, args, json, root);
  try {
    if (cmd === 'sessions') {
      const rows = db.all(
        `SELECT ${SESSION_COLS} FROM sessions
         WHERE (? IS NULL OR project LIKE '%' || ? || '%')
         ORDER BY started DESC LIMIT ?`,
        [project ?? null, project ?? null, limit],
      );
      process.stdout.write(json ? JSON.stringify(rows, null, 2) + '\n'
        : rows.map((r) =>
            `${local(r.started)} → ${local(r.ended, false)}  ${r.id.slice(0, ID_SHORT)}  ${r.project}  (${r.n_messages})  ${r.label}`,
          ).join('\n') + '\n');
      return 0;
    }

    if (cmd === 'session') {
      const prefix = args[0] || '';
      const hits = db.all(
        `SELECT ${SESSION_COLS} FROM sessions WHERE id LIKE ? || '%' ORDER BY started DESC`,
        [prefix],
      );
      if (hits.length === 0) { process.stderr.write(`q session: no session matches '${prefix}'\n`); return 1; }
      if (hits.length > 1) {
        process.stderr.write(`q session: '${prefix}' is ambiguous:\n`
          + hits.map((r) => `  ${r.id.slice(0, ID_SHORT)}  ${local(r.started)}  ${r.project}  ${r.label}\n`).join(''));
        return 1;
      }
      const s = hits[0];
      const messages = db.all('SELECT ts, role, text FROM messages WHERE session_id = ? ORDER BY seq', [s.id]);
      printSession(s, messages, json);
      return 0;
    }

    if (cmd === 'said') {
      const q = ftsAndQuery(args.join(' '));
      const rows = db.all(
        `SELECT m.ts, m.role, s.id AS session_id, s.project, s.label,
                snippet(messages_fts, ${SNIPPET_COL}, '[', ']', '…', ${SNIPPET_TOKENS}) AS hit
         FROM messages_fts f
         JOIN messages m ON m.session_id = f.session_id AND m.seq = f.seq
         JOIN sessions s ON s.id = m.session_id
         WHERE messages_fts MATCH ?
           AND (? IS NULL OR s.project LIKE '%' || ? || '%')
         ORDER BY m.ts DESC LIMIT ?`,
        [q, project ?? null, project ?? null, limit],
      );
      if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return 0; }
      if (rows.length === 0) { process.stdout.write('no hits\n'); return 0; }
      for (const r of rows) {
        process.stdout.write(`[${local(r.ts)}] ${r.project}  ${r.session_id.slice(0, ID_SHORT)}  ${speaker(r.role)}: ${r.hit}\n`);
      }
      process.stdout.write(`\n(open one: q session <id>)\n`);
      return 0;
    }

    process.stderr.write(`q-sessions: unknown command '${cmd}'\n`);
    return 2;
  } finally {
    db.close();
  }
}
