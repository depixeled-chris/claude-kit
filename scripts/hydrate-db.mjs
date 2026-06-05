#!/usr/bin/env node
// hydrate-db.mjs — build the DERIVED SQLite query cache from the .ai markdown stores
// (KIT-T004). The markdown is the single source of truth; this DB is disposable,
// gitignored, and ONE-WAY hydrated. Nothing ever writes it back to markdown.
//
//   node scripts/hydrate-db.mjs                  # hydrate ALL scopes -> <kit-root>/.cache/workflow.db
//   node scripts/hydrate-db.mjs --root <dir>     # hydrate ONE .ai root only (single-scope)
//   node scripts/hydrate-db.mjs --db <path>      # write the db somewhere else
//   node scripts/hydrate-db.mjs --if-stale       # skip if no store file is newer than db
//
// CROSS-SCOPE (KIT-T031): with no --root, the cache indexes EVERY registered project's
// stores (the registry's projects + central data, via projectAiDirs()) PLUS claude-kit's
// own .ai, unioned into the one DB. Scope still comes from each item's id prefix, so a
// query from any cwd sees all scopes. `--root <dir>` forces a single-scope hydrate.
//
// SCHEMA — borrowed in shape from the maintainer's workflow repo
// (server/prisma/schema.prisma) and ADAPTED to KIT's markdown-as-truth model:
//   * workflow's Project+Task (a row per work item, code/status/path) collapse into ONE
//     `items` table keyed by the markdown id, with scope split out (workflow used a
//     Project FK; KIT encodes scope in the id prefix).
//   * workflow's Comment.parentId threading + Task relations generalize into a single
//     `links(from,rel,to)` edge table — the relationship graph KIT-D012/T003 want.
//   * workflow's Document/Decision provenance maps to `artifacts(path,produced_by,informs)`.
//   * workflow's activity.service (which UNIONS comments/worklogs/decisions/blockers and
//     sorts by timestamp) becomes a materialized `history(item_id,ts,event,detail)` table.
//   * FTS5 replaces workflow's substring search — the agent-retrieval driver.
// DROPPED from workflow: the ORM, write-back, and DB-as-source — all edits go to markdown.

import { mkdirSync, statSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rowFromScan } from './db-parse.mjs';
import { statStoreFiles, readIdConfig } from './id-utils.mjs';
import { resolveEngine } from './db-engine.mjs';
import { projectAiDirs } from '../hooks/lib.mjs';

const KIT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// DB lives relative to the install (KIT-T004): <kit-root>/.cache/workflow.db. Honor
// $CLAUDE_PLUGIN_ROOT when the plugin runs from a different install dir.
export function defaultDbPath() {
  const base = process.env.CLAUDE_PLUGIN_ROOT || KIT_ROOT;
  return join(base, '.cache', 'workflow.db');
}

const SCHEMA = `
CREATE TABLE items (
  id        TEXT PRIMARY KEY,
  scope     TEXT NOT NULL,
  store     TEXT NOT NULL,
  type      TEXT,
  status    TEXT,
  priority  TEXT,
  title     TEXT,
  parent    TEXT,
  milestone TEXT,
  num       INTEGER,
  archived  INTEGER NOT NULL DEFAULT 0,
  file      TEXT NOT NULL
);
CREATE INDEX idx_items_scope    ON items(scope);
CREATE INDEX idx_items_store    ON items(store);
CREATE INDEX idx_items_status   ON items(status);
CREATE INDEX idx_items_priority ON items(priority);
CREATE INDEX idx_items_parent   ON items(parent);
CREATE INDEX idx_items_type     ON items(type);
CREATE INDEX idx_items_scope_store ON items(scope, store);
-- the incremental sync deletes a dirty/removed file's rows via WHERE file=? AND scope=? — REQUIRED
-- so that per-file delete is an index seek, not a full scan (KIT-T026 efficiency mandate).
CREATE INDEX idx_items_file        ON items(file, scope);
-- next-id MAX(num) + integrity collision/gap scans run constantly over (scope, store) ordered by num.
CREATE INDEX idx_items_scope_store_num ON items(scope, store, num);

CREATE TABLE links (
  from_id TEXT NOT NULL,
  rel     TEXT NOT NULL,
  to_id   TEXT NOT NULL
);
CREATE INDEX idx_links_from ON links(from_id);
CREATE INDEX idx_links_to   ON links(to_id);
CREATE INDEX idx_links_rel  ON links(rel);

CREATE TABLE aka (
  item_id TEXT NOT NULL,
  alias   TEXT NOT NULL
);
CREATE INDEX idx_aka_item  ON aka(item_id);
CREATE INDEX idx_aka_alias ON aka(alias);

CREATE TABLE artifacts (
  path        TEXT NOT NULL,
  produced_by TEXT,
  informs     TEXT
);
CREATE INDEX idx_artifacts_produced ON artifacts(produced_by);

CREATE TABLE history (
  item_id TEXT NOT NULL,
  ts      TEXT,
  event   TEXT,
  detail  TEXT
);
CREATE INDEX idx_history_item  ON history(item_id, ts);
CREATE INDEX idx_history_ts    ON history(ts);
CREATE INDEX idx_history_event ON history(event);

-- Standalone (non-contentless) FTS5: it stores its own copy of title+body so snippet()
-- and column reads work. A contentless table (content='') would need external rowid
-- management and can't return content — wrong fit for an agent-retrieval index.
CREATE VIRTUAL TABLE items_fts USING fts5(id UNINDEXED, title, body);

-- Stat-only manifest of every indexed store file (KIT-T026/KIT-D024). Keyed on (relpath,
-- scope) so the SAME relpath in two scopes' stores never collides. The incremental sync
-- diffs on-disk {mtime,size} against this to find the dirty set, so an unchanged file is
-- never re-read. relpath matches items.file (e.g. tickets/KIT-T001-foo.md).
CREATE TABLE source_files (
  relpath TEXT NOT NULL,
  scope   TEXT NOT NULL,
  mtime   REAL,
  size    INTEGER,
  PRIMARY KEY (relpath, scope)
);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

// Bump when SCHEMA changes shape — a DB stamped with an older version is dropped and rebuilt
// from scratch (the sync then full-populates into the fresh DB). This is the ONLY drop path,
// and it fires only on a genuine schema change, never on a routine sync. KIT-T026 added the
// source_files manifest (v2) + the index set the incremental sync / next-id / integrity scans
// need (v3): idx_items_file (per-file delete), idx_items_type, (scope,store,num), (item_id,ts).
const SCHEMA_VERSION = '3';

// Newest mtime across every markdown file under an .ai store dir — the staleness signal
// for --if-stale. Takes the .ai dir directly so central-data stores (no nested .ai) work.
function newestMtime(aiDir) {
  let newest = 0;
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  walk(aiDir);
  return newest;
}

// The store sources to union into the cache. A single root (`--root`) hydrates just that
// scope; otherwise EVERY registered project (projectAiDirs) plus claude-kit's own .ai —
// cross-scope (KIT-T031). De-duped by aiDir so the kit appearing in both the registry and
// as KIT_ROOT is counted once. Each source: { root, aiDir } — root seeds the scope-key
// fallback, aiDir is where the markdown lives.
export function hydrationSources(root) {
  if (root) return [{ root, aiDir: join(root, '.ai') }];
  const sources = [{ root: KIT_ROOT, aiDir: join(KIT_ROOT, '.ai') }];
  for (const { aiDir } of projectAiDirs()) {
    // root = aiDir's parent for an in-repo store, else aiDir itself (central data has no
    // nested .ai); collectItems uses aiDir for the markdown and root only for the key.
    const root = aiDir.endsWith(join('', '.ai')) || /[\\/]\.ai$/.test(aiDir) ? dirname(aiDir) : aiDir;
    sources.push({ root, aiDir });
  }
  const seen = new Set();
  return sources.filter((s) => {
    const k = resolve(s.aiDir);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Insert one parsed item's rows across every table. The inverse of deleteItemRows — together
// they make a per-file re-parse a delete-then-insert of EXACTLY that item's rows, leaving
// every other item untouched (the KIT-T026 efficiency invariant).
function insertItem(db, it) {
  db.run(
    `INSERT INTO items (id, scope, store, type, status, priority, title, parent, milestone, num, archived, file)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [it.id, it.scope, it.store, it.type, it.status, it.priority, it.title,
      it.parent || null, it.milestone || null, it.num, it.archived, it.file],
  );
  db.run('INSERT INTO items_fts (id, title, body) VALUES (?,?,?)', [it.id, it.title || '', it.body || '']);

  for (const a of it.aka) db.run('INSERT INTO aka (item_id, alias) VALUES (?,?)', [it.id, a]);

  const edge = (rel, to) => { if (to) db.run('INSERT INTO links (from_id, rel, to_id) VALUES (?,?,?)', [it.id, rel, to]); };
  for (const to of it.links) edge('link', to);
  if (it.parent) edge('parent', it.parent);
  edge('regressed_from', it.regressedFrom);
  edge('introduced_by', it.introducedBy);
  // commit↔ticket foreign keys (KIT-T026): ticket→commit-sha edges, so a commit→ticket
  // lookup is an indexed idx_links_to scan (the agent-retrieval cross-ref, KIT-T004).
  edge('caused_by', it.causingCommit);
  edge('fixed_by', it.fixedCommit);
  // supersede edges (KIT-T024) — newer→older (supersedes) + older→newer (superseded_by),
  // so a backlinks/chain walk resolves a supersede chain like the regression chains do.
  edge('supersedes', it.supersedes);
  edge('superseded_by', it.supersededBy);

  if (it.producedBy || it.informs.length) {
    // a work item that produces a doc shows up as an artifact edge; informs is many
    for (const inf of it.informs.length ? it.informs : [null]) {
      db.run('INSERT INTO artifacts (path, produced_by, informs) VALUES (?,?,?)', [it.file, it.producedBy || it.id, inf]);
    }
  }

  for (const h of it.history) {
    db.run('INSERT INTO history (item_id, ts, event, detail) VALUES (?,?,?,?)', [it.id, h.ts, h.event, h.detail]);
  }
}

// Drop every row a single item id owns — the inverse of insertItem. artifacts has no item_id
// column, so it is keyed by the file path the artifact edge was inserted with (it.file).
function deleteItemRows(db, id, file) {
  db.run('DELETE FROM items WHERE id = ?', [id]);
  db.run('DELETE FROM items_fts WHERE id = ?', [id]);
  db.run('DELETE FROM aka WHERE item_id = ?', [id]);
  db.run('DELETE FROM links WHERE from_id = ?', [id]);
  db.run('DELETE FROM history WHERE item_id = ?', [id]);
  if (file) db.run('DELETE FROM artifacts WHERE path = ? AND produced_by = ?', [file, id]);
}

// Open the DB for a sync, recreating it from scratch when it is absent OR stamped with an
// older schema. A fresh DB is the natural full-populate path (rm db + sync reproduces the
// same set, KIT-T004) — the sync below sees an empty manifest and treats every file as new.
function openForSync(open, dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  let db = existsSync(dbPath) ? open(dbPath) : null;
  let fresh = !db;
  if (db) {
    let version = '';
    try {
      version = (db.all("SELECT value FROM meta WHERE key='schema_version'")[0] || {}).value || '';
    } catch {
      version = ''; // pre-source_files schema (no/old meta) → must rebuild
    }
    if (version !== SCHEMA_VERSION) {
      db.close();
      rmSync(dbPath, { force: true });
      // sidecar WAL/SHM files would otherwise carry stale pages into the new DB
      for (const ext of ['-wal', '-shm']) rmSync(dbPath + ext, { force: true });
      db = null;
      fresh = true;
    }
  }
  if (!db) {
    db = open(dbPath);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
    db.run('INSERT INTO meta (key, value) VALUES (?,?)', ['schema_version', SCHEMA_VERSION]);
  }
  return { db, fresh };
}

// `root` defaults to undefined → cross-scope. Pass an explicit root for single-scope.
//
// INCREMENTAL SYNC (KIT-T026/KIT-D024): no drop-and-rebuild. The DB carries a stat-only
// manifest (source_files); each sync stats every store file, diffs against the manifest, and
// touches ONLY the dirty set — new/changed files are re-parsed + re-upserted, deleted files
// have their rows removed, unchanged files are skipped entirely (never read, never written).
// A full populate happens only as the natural result of syncing into a fresh/empty DB, so
// `rm db + sync` still reproduces the cache exactly.
export async function hydrate({ root, dbPath = defaultDbPath(), ifStale = false } = {}) {
  const open = await resolveEngine();
  if (!open) {
    return { ok: false, reason: 'no-engine', engine: null };
  }

  const sources = hydrationSources(root);

  if (ifStale && existsSync(dbPath)) {
    const dbAge = statSync(dbPath).mtimeMs;
    const newest = Math.max(0, ...sources.map((s) => newestMtime(s.aiDir)));
    if (newest <= dbAge) {
      return { ok: true, skipped: true, dbPath };
    }
  }

  const { db, fresh } = openForSync(open, dbPath);
  try {
    db.exec('BEGIN');

    let reparsed = 0;
    let deleted = 0;
    // Per (scope, relpath): an item id may move scopes only by changing its id prefix, which
    // also changes the file, so (scope, relpath) is a stable manifest key. The diff is per
    // SOURCE, since each source carries one scope's stores.
    for (const s of sources) {
      const { key } = readIdConfig(s.root, s.aiDir);
      const scope = key || '';
      // (a) STAT every store file — no content reads. This is the global "temperature".
      const onDisk = statStoreFiles(s.aiDir);
      const byRel = new Map(onDisk.map((e) => [e.relpath, e]));

      // (b) the stored manifest for THIS source's scope only — a source maps to exactly one
      // scope (its ids.key), so other scopes' manifest rows must not enter this diff (else a
      // cross-scope hydrate would delete another scope's files as "missing"). A fresh DB has
      // none, so every file is "new" → full populate.
      const stored = new Map(
        db.all('SELECT relpath, scope, mtime, size FROM source_files WHERE scope = ?', [scope])
          .map((r) => [r.relpath, r]),
      );

      // (c) diff + apply. DIRTY (new or mtime/size differ) → re-parse only that file; DELETED
      // (in manifest, gone on disk) → drop its rows. UNCHANGED → skip (no read, no write).
      for (const e of onDisk) {
        const prev = stored.get(e.relpath);
        const dirty = !prev || prev.mtime !== e.mtimeMs || prev.size !== e.size;
        if (!dirty) continue;
        const it = rowFromScan(s.aiDir, e, key);
        // Replace this file's existing rows (if any) before inserting the fresh parse, so an
        // edit that renames the item's id still leaves no orphan rows for this file.
        if (prev) {
          for (const r of db.all('SELECT id, file FROM items WHERE file = ? AND scope = ?', [e.relpath, scope])) {
            deleteItemRows(db, r.id, r.file);
          }
        }
        deleteItemRows(db, it.id, it.file);
        insertItem(db, it);
        db.run(
          `INSERT INTO source_files (relpath, scope, mtime, size) VALUES (?,?,?,?)
           ON CONFLICT(relpath, scope) DO UPDATE SET mtime=excluded.mtime, size=excluded.size`,
          [e.relpath, scope, e.mtimeMs, e.size],
        );
        reparsed++;
      }

      // (d) files in the manifest but no longer on disk → delete their rows + manifest entry.
      for (const relpath of stored.keys()) {
        if (byRel.has(relpath)) continue;
        for (const r of db.all('SELECT id, file FROM items WHERE file = ? AND scope = ?', [relpath, scope])) {
          deleteItemRows(db, r.id, r.file);
        }
        db.run('DELETE FROM source_files WHERE relpath = ? AND scope = ?', [relpath, scope]);
        deleted++;
      }
    }

    const itemCount = (db.all('SELECT COUNT(*) n FROM items')[0] || {}).n || 0;
    // Refresh the meta heartbeat ONLY when the sync actually changed something (or just built a
    // fresh DB). A true no-op writes literally nothing — the efficiency invariant (KIT-T026).
    if (fresh || reparsed || deleted) {
      const setMeta = (k, v) => db.run(
        'INSERT INTO meta (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, String(v)]);
      setMeta('hydrated_at', new Date().toISOString());
      setMeta('source_root', sources.map((s) => resolve(s.aiDir)).join(';'));
      setMeta('item_count', itemCount);
    }
    db.exec('COMMIT');
    return { ok: true, dbPath, engine: db.name, items: itemCount, scopes: sources.length, reparsed, deleted, fresh };
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* already closed/failed */ }
    throw e;
  } finally {
    db.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  let root; // undefined → cross-scope (all registered projects + kit); --root forces single
  let dbPath = defaultDbPath();
  let ifStale = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') root = args[++i];
    else if (args[i] === '--db') dbPath = args[++i];
    else if (args[i] === '--if-stale') ifStale = true;
  }
  const r = await hydrate({ root, dbPath, ifStale });
  if (!r.ok && r.reason === 'no-engine') {
    process.stderr.write(
      'hydrate-db: no SQLite engine (install better-sqlite3 or run on Node 22+ for node:sqlite).\n' +
      'Queries will fall back to a markdown scan; the cache is optional.\n',
    );
    process.exit(0); // non-fatal: the cache is never a hard dependency
  }
  if (r.skipped) {
    process.stdout.write(`hydrate-db: up to date (${dbPath}).\n`);
    return;
  }
  process.stdout.write(`hydrate-db: ${r.items} items -> ${dbPath} [${r.engine}]\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('hydrate-db: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
