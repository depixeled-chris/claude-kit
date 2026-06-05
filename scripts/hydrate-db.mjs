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
import { collectItems } from './db-parse.mjs';
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
CREATE INDEX idx_items_scope_store ON items(scope, store);

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
CREATE INDEX idx_history_item  ON history(item_id);
CREATE INDEX idx_history_ts    ON history(ts);
CREATE INDEX idx_history_event ON history(event);

-- Standalone (non-contentless) FTS5: it stores its own copy of title+body so snippet()
-- and column reads work. A contentless table (content='') would need external rowid
-- management and can't return content — wrong fit for an agent-retrieval index.
CREATE VIRTUAL TABLE items_fts USING fts5(id UNINDEXED, title, body);

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
`;

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

// `root` defaults to undefined → cross-scope. Pass an explicit root for single-scope.
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

  // Union every source; a later scope never overwrites an earlier one's id (scopes are
  // disjoint by prefix, but dedup on id keeps the INSERT safe if a store is double-listed).
  const items = [];
  const seenIds = new Set();
  for (const s of sources) {
    for (const it of collectItems(s.root, s.aiDir)) {
      if (it.id && seenIds.has(it.id)) continue;
      if (it.id) seenIds.add(it.id);
      items.push(it);
    }
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  // Full rebuild each time = idempotent + trivially correct (no diff/merge logic). The DB
  // is disposable, so dropping and recreating is the simplest path to "rm + re-hydrate
  // reproduces it exactly".
  if (existsSync(dbPath)) rmSync(dbPath);
  const db = open(dbPath);
  try {
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    db.exec(SCHEMA);
    db.exec('BEGIN');

    for (const it of items) {
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

    const now = new Date().toISOString();
    db.run('INSERT INTO meta (key, value) VALUES (?,?)', ['hydrated_at', now]);
    db.run('INSERT INTO meta (key, value) VALUES (?,?)',
      ['source_root', sources.map((s) => resolve(s.aiDir)).join(';')]);
    db.run('INSERT INTO meta (key, value) VALUES (?,?)', ['item_count', String(items.length)]);
    db.exec('COMMIT');
    return { ok: true, dbPath, engine: db.name, items: items.length, scopes: sources.length };
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
