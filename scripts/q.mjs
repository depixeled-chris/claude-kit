#!/usr/bin/env node
// q.mjs — the query interface over the KIT-T004 cache (the agent-retrieval layer: QUERY
// the cache, don't open files). Canned graph/FTS queries + ad-hoc SQL, compact output.
//
//   node scripts/q.mjs open [scope]                 # open items (todo|doing|review)
//   node scripts/q.mjs children <id>                # items whose parent is <id>
//   node scripts/q.mjs backlinks <id>               # items that link TO <id> (any rel)
//   node scripts/q.mjs doc-trail <id>               # history events for <id>, newest first
//   node scripts/q.mjs fts <query...>               # full-text search title+body
//   node scripts/q.mjs next-id <scope> <type>       # O(1) next free id (max(num)+1)
//   node scripts/q.mjs rundown                       # per-scope open-item counts
//   node scripts/q.mjs integrity                     # orphan parents / dangling links / gaps
//   node scripts/q.mjs sql "SELECT ..."             # ad-hoc read-only SQL
//   node scripts/q.mjs --json <cmd> ...             # machine-readable output
//
// QUERY PATTERNS borrowed from the workflow repo's services + ADAPTED:
//   * `open` mirrors assignments/blockers.service getX(params) — a WHERE-filtered list.
//   * `children`/`backlinks` mirror comments.service's parentId tree walk, generalized to
//     the links graph (upward-stored parent, downward-generated view — KIT-D012).
//   * `doc-trail` mirrors activity.service's per-task timeline (sorted desc).
//   * `next-id`/`integrity` realize KIT-T009's markdown-served logic as O(1) SQL.
//
// FALLBACK: with no DB (or no SQLite engine), every canned query degrades to an in-memory
// markdown scan via db-parse, so an agent/hook still gets answers — the cache is optional.

import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEngine } from './db-engine.mjs';
import { collectItems } from './db-parse.mjs';
import { hydrate, defaultDbPath } from './hydrate-db.mjs';
import { readIdConfig, STORE_TYPE, compareIds } from './id-utils.mjs';

const OPEN = ['todo', 'doing', 'review'];
const FTS_LIMIT = 25;        // cap FTS hits — a retrieval list, not a full dump
const SNIPPET_COL = 2;       // items_fts column index of `body` for snippet()
const SNIPPET_TOKENS = 8;    // words of context around an FTS match

function newestStoreMtime(root) {
  const ai = join(root, '.ai');
  let newest = 0;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  walk(ai);
  return newest;
}

// Open the cache, auto-(re)hydrating when it is missing or stale. Returns a db handle, or
// null when no SQLite engine exists (caller then uses the markdown fallback).
async function db(root, dbPath) {
  const open = await resolveEngine();
  if (!open) return null;
  const stale = !existsSync(dbPath) || statSync(dbPath).mtimeMs < newestStoreMtime(root);
  if (stale) await hydrate({ root, dbPath });
  return open(dbPath);
}

function storeForType(type) {
  // type may be a store name (tickets) or a type letter/word; map to a store bucket.
  if (STORE_TYPE[type]) return type;
  const byLetter = Object.entries(STORE_TYPE).find(([, l]) => l === type);
  return byLetter ? byLetter[0] : 'tickets';
}

function formatId(root, scope, type, num) {
  const { pad } = readIdConfig(root);
  const letter = STORE_TYPE[type] || type;
  return `${scope}-${letter}${String(num).padStart(pad, '0')}`;
}

// ---- SQLite-backed canned queries -----------------------------------------
function cannedQueries(root) {
  return {
    open: (db, scope) => db.all(
      `SELECT id, type, status, priority, title FROM items
       WHERE status IN (${OPEN.map(() => '?').join(',')}) AND archived = 0
         ${scope ? 'AND scope = ?' : ''}
       ORDER BY priority, id`,
      scope ? [...OPEN, scope] : [...OPEN]),

    children: (db, id) => db.all(
      'SELECT id, type, status, title FROM items WHERE parent = ? ORDER BY id', [id]),

    backlinks: (db, id) => db.all(
      `SELECT i.id, i.type, i.status, l.rel, i.title
       FROM links l JOIN items i ON i.id = l.from_id
       WHERE l.to_id = ? ORDER BY l.rel, i.id`, [id]),

    'doc-trail': (db, id) => db.all(
      'SELECT ts, event, detail FROM history WHERE item_id = ? ORDER BY ts DESC', [id]),

    fts: (db, query) => db.all(
      `SELECT f.id, i.type, i.status, i.title, snippet(items_fts, ?, '[', ']', '…', ?) AS hit
       FROM items_fts f JOIN items i ON i.id = f.id
       WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`, [SNIPPET_COL, SNIPPET_TOKENS, query, FTS_LIMIT]),

    rundown: (db) => db.all(
      `SELECT scope,
              SUM(status IN ('todo','doing','review')) AS open,
              SUM(status='doing') AS doing,
              SUM(status='review') AS review
       FROM items WHERE archived = 0 GROUP BY scope ORDER BY scope`),

    'next-id': (db, scope, type) => {
      const row = db.all(
        'SELECT MAX(num) AS m FROM items WHERE scope = ? AND store = ?', [scope, storeForType(type)])[0];
      const next = (row && row.m ? row.m : 0) + 1;
      return [{ id: formatId(root, scope, type, next), scope, type, num: next }];
    },

    integrity: (db) => {
      const orphanParents = db.all(
        `SELECT i.id, i.parent FROM items i
         WHERE i.parent IS NOT NULL AND i.parent <> ''
           AND NOT EXISTS (SELECT 1 FROM items p WHERE p.id = i.parent)`);
      const danglingLinks = db.all(
        `SELECT DISTINCT l.from_id, l.rel, l.to_id FROM links l
         WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = l.to_id)
           AND l.to_id LIKE '%-%' ORDER BY l.from_id`);
      const gaps = findGaps(db.all('SELECT scope, store, num FROM items WHERE num IS NOT NULL'));
      const collisions = db.all(
        'SELECT scope, store, num, COUNT(*) c FROM items WHERE num IS NOT NULL GROUP BY scope, store, num HAVING c > 1');
      return { orphanParents, danglingLinks, gaps, collisions };
    },
  };
}

// Missing numbers within each (scope,store) sequence — reported, never auto-filled
// (KIT-T009: a returned next-id is always fresh; gaps from deletions stay gaps).
function findGaps(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.scope}/${r.store}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r.num);
  }
  const gaps = [];
  for (const [k, nums] of byKey) {
    const set = new Set(nums);
    const max = Math.max(...nums);
    for (let n = 1; n < max; n++) if (!set.has(n)) gaps.push(`${k}#${n}`);
  }
  return gaps;
}

// ---- markdown-scan fallback (no SQLite engine) ----------------------------
// Mirrors each canned query against the parsed items so answers survive without a DB.
function fallback(cmd, args, root) {
  const items = collectItems(root);
  const byId = new Map(items.map((i) => [i.id, i]));
  switch (cmd) {
    case 'open': {
      const scope = args[0];
      return items.filter((i) => OPEN.includes(i.status) && !i.archived && (!scope || i.scope === scope))
        .sort((a, b) => compareIds(a.id, b.id))
        .map((i) => ({ id: i.id, type: i.type, status: i.status, priority: i.priority, title: i.title }));
    }
    case 'children':
      return items.filter((i) => i.parent === args[0]).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    case 'backlinks': {
      const id = args[0];
      const out = [];
      for (const i of items) {
        const rels = [...i.links.map((t) => ['link', t]), i.parent ? ['parent', i.parent] : null,
          i.regressedFrom ? ['regressed_from', i.regressedFrom] : null].filter(Boolean);
        for (const [rel, to] of rels) if (to === id) out.push({ id: i.id, type: i.type, status: i.status, rel, title: i.title });
      }
      return out;
    }
    case 'doc-trail':
      return (byId.get(args[0])?.history || []).slice().sort((a, b) => String(b.ts).localeCompare(a.ts));
    case 'fts': {
      const needle = args.join(' ').toLowerCase();
      return items.filter((i) => (`${i.title} ${i.body}`).toLowerCase().includes(needle))
        .slice(0, FTS_LIMIT).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    }
    case 'rundown': {
      const m = new Map();
      for (const i of items) {
        if (i.archived) continue;
        const r = m.get(i.scope) || { scope: i.scope, open: 0, doing: 0, review: 0 };
        if (OPEN.includes(i.status)) r.open++;
        if (i.status === 'doing') r.doing++;
        if (i.status === 'review') r.review++;
        m.set(i.scope, r);
      }
      return [...m.values()].sort((a, b) => a.scope.localeCompare(b.scope));
    }
    case 'next-id': {
      const [scope, type] = args;
      const store = storeForType(type);
      const max = items.filter((i) => i.scope === scope && i.store === store && i.num).reduce((a, i) => Math.max(a, i.num), 0);
      return [{ id: formatId(root, scope, type, max + 1), scope, type, num: max + 1 }];
    }
    default:
      throw new Error(`'${cmd}' has no markdown fallback (needs SQLite). sql/integrity require the cache.`);
  }
}

// ---- output ---------------------------------------------------------------
function printRows(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  if (!rows || (Array.isArray(rows) && !rows.length)) { process.stdout.write('(no results)\n'); return; }
  if (typeof rows === 'object' && !Array.isArray(rows)) {
    for (const [k, v] of Object.entries(rows)) {
      process.stdout.write(`${k}: ${Array.isArray(v) ? v.length : v}\n`);
      if (Array.isArray(v)) for (const r of v) process.stdout.write('  ' + compact(r) + '\n');
    }
    return;
  }
  for (const r of rows) process.stdout.write(compact(r) + '\n');
}
const compact = (r) =>
  typeof r === 'string' ? r : Object.values(r).map((v) => (v === null ? '' : String(v))).join('  ');

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  // --no-db forces the markdown-scan path (bypass a possibly-stale cache; also proves the
  // fallback works the same as when no SQLite engine is present).
  const noDb = argv.includes('--no-db');
  let root = process.cwd();
  const ri = argv.indexOf('--root');
  if (ri >= 0) root = argv[ri + 1];
  const FLAGS = new Set(['--json', '--no-db']);
  const rest = argv.filter((a, i) => !FLAGS.has(a) && a !== '--root' && argv[i - 1] !== '--root');
  const [cmd, ...args] = rest;
  if (!cmd) { process.stderr.write('usage: q.mjs <open|children|backlinks|doc-trail|fts|next-id|rundown|integrity|sql> [args]\n'); process.exit(2); }

  const dbPath = defaultDbPath();
  const handle = noDb ? null : await db(root, dbPath);

  if (cmd === 'sql') {
    if (!handle) { process.stderr.write('q: ad-hoc SQL needs a SQLite engine (none found).\n'); process.exit(1); }
    const sql = args.join(' ');
    if (!/^\s*(select|with|pragma|explain)\b/i.test(sql)) { process.stderr.write('q: only read-only SQL (SELECT/WITH/PRAGMA/EXPLAIN) — the cache is never written back.\n'); process.exit(1); }
    printRows(handle.all(sql), json);
    handle.close();
    return;
  }

  if (!handle) {
    printRows(fallback(cmd, args, root), json);
    return;
  }

  const Q = cannedQueries(root);
  const fn = Q[cmd];
  if (!fn) { handle.close(); process.stderr.write(`q: unknown query '${cmd}'.\n`); process.exit(2); }
  const result = cmd === 'fts' ? fn(handle, args.join(' ')) : fn(handle, ...args);
  printRows(result, json);
  handle.close();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('q: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
