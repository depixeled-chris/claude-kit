#!/usr/bin/env node
// session-ingest.mjs — build the DERIVED sessions.db from Claude Code's own session
// transcripts (KIT-T100). Claude Code already logs every terminal session to
// ~/.claude/projects/<encoded-cwd>/<session-uuid>.jsonl with a timestamp on every line;
// what's missing is readability and search. This ingests ONLY the conversation (user
// prompts + assistant reply text — never tool dumps or file-history snapshots, which are
// most of the bytes) into a SQLite FTS5 cache, so `q sessions/session/said` can answer
// "what was said, when, in which terminal".
//
// SEPARATE DB, deliberately (maintainer decision 2026-07-10): workflow.db is deleted and
// rebuilt from markdown whenever stores change and takes hot tiny writes from every open
// terminal's hooks; sessions.db takes rare bulky ingests from transcripts. Sharing a file
// would put the 750 MB transcript re-chew inside the work cache's rebuild lifecycle and
// its hot write path. Same engine cascade, same `q` front door — the split is two FILES,
// not two systems.
//
// CONCURRENCY: transcripts never contend (one file per session, appended by the harness).
// This DB is written LAZILY at query time (--if-stale semantics), WAL journal mode, and
// every write path is fail-open — a busy/locked ingest skips and the next query repairs.
//
// DEFENSIVE PARSING: the transcript format is documented as internal and version-unstable.
// Every line parses in its own try/catch; unknown shapes are skipped, never fatal. The DB
// is disposable and rebuilt from the transcripts at any time (--force).
//
//   node scripts/session-ingest.mjs                # ingest changed transcripts
//   node scripts/session-ingest.mjs --force        # drop + rebuild everything
//   node scripts/session-ingest.mjs --db <path> --projects-dir <dir>

import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { resolveEngine } from './db-engine.mjs';

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** sessions.db beside workflow.db — same install-relative placement (KIT-T004 rule). */
export function sessionsDbPath() {
  const base = process.env.CLAUDE_PLUGIN_ROOT || KIT_ROOT;
  return join(base, '.cache', 'sessions.db');
}

/** Where Claude Code keeps per-project session transcripts. */
export function transcriptsRoot() {
  return join(homedir(), '.claude', 'projects');
}

const LABEL_MAX = 80; // first real prompt, truncated — the "which terminal was that" handle

// Machine artifacts that ride the user role but are not the user speaking.
const NOISE_PREFIXES = ['<local-command', '<command-name', '<system-reminder', 'Caveat: The messages below'];

/** Text of a message whose content is a string or an array of typed parts. */
function textOf(message) {
  const c = message && message.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    return c.filter((p) => p && p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text).join('\n');
  }
  return '';
}

/**
 * Parse one transcript into { id, project, file, started, ended, label, messages }.
 * Keeps main-thread user/assistant text only: sidechains are subagent internals, and
 * NOISE_PREFIXES are harness echoes (command output, injected reminders) — dropping them
 * is what keeps the DB tens of MB instead of transcript-sized.
 */
export function parseTranscript(path, project) {
  const id = basename(path, '.jsonl');
  const messages = [];
  let started = '';
  let ended = '';
  let label = '';
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { return null; }
  for (const line of raw.split('\n')) {
    if (!line) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.timestamp) {
      if (!started || obj.timestamp < started) started = obj.timestamp;
      if (obj.timestamp > ended) ended = obj.timestamp;
    }
    if ((obj.type !== 'user' && obj.type !== 'assistant') || obj.isSidechain || !obj.message) continue;
    const text = textOf(obj.message).trim();
    if (!text || NOISE_PREFIXES.some((p) => text.startsWith(p))) continue;
    messages.push({ ts: obj.timestamp || ended, role: obj.type, text });
    if (!label && obj.type === 'user') {
      label = text.replace(/\s+/g, ' ').slice(0, LABEL_MAX);
    }
  }
  return { id, project, file: path, started, ended, label, messages };
}

/** Every transcript under the projects root: [{ path, project, mtime, size }]. */
export function listTranscripts(root) {
  const out = [];
  let dirs;
  try { dirs = readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const dir = join(root, d.name);
    let files;
    try { files = readdirSync(dir); } catch { continue; }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      const path = join(dir, f);
      try {
        const st = statSync(path);
        out.push({ path, project: d.name, mtime: st.mtimeMs, size: st.size });
      } catch { /* raced a deletion — skip */ }
    }
  }
  return out;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS files(path TEXT PRIMARY KEY, mtime REAL, size INTEGER);
CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY, project TEXT, file TEXT,
  started TEXT, ended TEXT, label TEXT, n_messages INTEGER
);
CREATE TABLE IF NOT EXISTS messages(
  session_id TEXT, seq INTEGER, ts TEXT, role TEXT, text TEXT,
  PRIMARY KEY(session_id, seq)
);
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(text, session_id UNINDEXED, seq UNINDEXED);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started);
`;

/** Open (or create) sessions.db on the engine cascade. Null when no engine exists. */
export async function openSessionsDb(dbPath = sessionsDbPath()) {
  const engine = await resolveEngine();
  if (!engine) return null;
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = engine(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

/**
 * Incremental ingest: a transcript is re-read only when its (mtime, size) differs from
 * the manifest — transcripts are append-only, and whole-file re-parse of one session is
 * milliseconds, so no tail-tracking. FAIL-OPEN per file: a parse/write error skips that
 * file and the next ingest retries it.
 */
export async function ingestSessions({ dbPath = sessionsDbPath(), root = transcriptsRoot(), force = false } = {}) {
  const db = await openSessionsDb(dbPath);
  if (!db) return { error: 'no-engine' };
  const stats = { seen: 0, ingested: 0, skipped: 0, failed: 0 };
  try {
    if (force) {
      db.exec('DELETE FROM files; DELETE FROM sessions; DELETE FROM messages; DELETE FROM messages_fts;');
    }
    const manifest = new Map(db.all('SELECT path, mtime, size FROM files').map((r) => [r.path, r]));
    for (const t of listTranscripts(root)) {
      stats.seen++;
      const known = manifest.get(t.path);
      if (known && known.mtime === t.mtime && known.size === t.size) { stats.skipped++; continue; }
      try {
        const s = parseTranscript(t.path, t.project);
        if (!s) { stats.failed++; continue; }
        db.exec('BEGIN');
        db.run('DELETE FROM messages WHERE session_id = ?', [s.id]);
        db.run('DELETE FROM messages_fts WHERE session_id = ?', [s.id]);
        db.run('DELETE FROM sessions WHERE id = ?', [s.id]);
        db.run(
          'INSERT INTO sessions(id, project, file, started, ended, label, n_messages) VALUES (?,?,?,?,?,?,?)',
          [s.id, s.project, s.file, s.started, s.ended, s.label, s.messages.length],
        );
        s.messages.forEach((m, seq) => {
          db.run('INSERT INTO messages(session_id, seq, ts, role, text) VALUES (?,?,?,?,?)', [s.id, seq, m.ts, m.role, m.text]);
          db.run('INSERT INTO messages_fts(text, session_id, seq) VALUES (?,?,?)', [m.text, s.id, seq]);
        });
        db.run('INSERT OR REPLACE INTO files(path, mtime, size) VALUES (?,?,?)', [t.path, t.mtime, t.size]);
        db.exec('COMMIT');
        stats.ingested++;
      } catch (e) {
        try { db.exec('ROLLBACK'); } catch { /* no open tx */ }
        stats.failed++;
        process.stderr.write(`[session-ingest] skipped ${t.path}: ${e && e.message ? e.message : e}\n`);
      }
    }
  } finally {
    db.close();
  }
  return stats;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const result = await ingestSessions({
    dbPath: flag('--db'),
    root: flag('--projects-dir'),
    force: argv.includes('--force'),
  });
  if (result.error === 'no-engine') {
    process.stderr.write('session-ingest: no SQLite engine — sessions cache unavailable.\n');
    process.exit(1);
  }
  process.stdout.write(`sessions: ${result.ingested} ingested, ${result.skipped} unchanged, ${result.failed} failed (${result.seen} transcripts)\n`);
}
