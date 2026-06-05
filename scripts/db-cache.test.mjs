#!/usr/bin/env node
// Tests for the KIT-T004 SQLite query cache: parse → hydrate → query, idempotency, and
// the markdown-scan fallback. Builds a throwaway .ai store in a temp dir so the test is
// hermetic (no dependency on the live claude-kit stores). Skips the SQLite-backed half if
// no engine is present — the cache is optional, and so is testing it.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { collectItems } from './db-parse.mjs';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';
import { query } from './q.mjs';
import { nextId } from './id-utils.mjs';

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

// ---- fixture --------------------------------------------------------------
const root = mkdtempSync(join(tmpdir(), 'kit-cache-'));
const ai = join(root, '.ai');
mkdirSync(join(ai, 'tickets'), { recursive: true });
mkdirSync(join(ai, 'decisions'), { recursive: true });
writeFileSync(join(ai, 'config.yml'), 'ids:\n  key: "TST"\n  pad: 3\n');
writeFileSync(join(ai, 'tickets', 'TST-T001-root.md'),
  `---\nid: TST-T001\ntitle: root ticket about widgets\ntype: feature\nstatus: doing\npriority: high\nlinks: [TST-D001]\n---\n## Description\nthe widget engine\n`);
writeFileSync(join(ai, 'tickets', 'TST-T002-child.md'),
  `---\nid: TST-T002\ntitle: child of root\ntype: bug\nstatus: todo\npriority: critical\nparent: TST-T001\naka: [OLD-9]\n---\n## History\n- [2026-06-04 10:00] (created) opened\n`);
writeFileSync(join(ai, 'decisions', 'TST-D001.md'),
  `---\nid: TST-D001\ntitle: use widgets\ndate: 2026-06-04\n---\n**Decision:** widgets it is\n`);

// ---- pure parse (always runs) ---------------------------------------------
const items = collectItems(root);
test('collectItems finds all three items', () => assert.equal(items.length, 3));
test('scope derived from id prefix', () => assert.equal(items.find((i) => i.id === 'TST-T001').scope, 'TST'));
test('parent edge parsed', () => assert.equal(items.find((i) => i.id === 'TST-T002').parent, 'TST-T001'));
test('aka parsed', () => assert.deepEqual(items.find((i) => i.id === 'TST-T002').aka, ['OLD-9']));
test('history event parsed', () => {
  const h = items.find((i) => i.id === 'TST-T002').history;
  assert.equal(h.length, 1);
  assert.equal(h[0].event, 'created');
});
test('num parsed for next-id', () => assert.equal(Math.max(...items.filter((i) => i.store === 'tickets').map((i) => i.num)), 2));

// ---- SQLite-backed (skipped when no engine) -------------------------------
const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — fallback-only environment)');
} else {
  const dbPath = join(root, '.cache', 'workflow.db');

  await testAsync('hydrate builds the db', async () => {
    const r = await hydrate({ root, dbPath });
    assert.ok(r.ok && existsSync(dbPath), 'db should exist');
    assert.equal(r.items, 3);
  });

  // logical dump used to prove idempotency
  const dump = () => {
    const db = engine(dbPath);
    const out = JSON.stringify({
      items: db.all('SELECT id,scope,store,type,status,priority,title,parent,num FROM items ORDER BY id'),
      links: db.all('SELECT from_id,rel,to_id FROM links ORDER BY from_id,rel,to_id'),
      aka: db.all('SELECT item_id,alias FROM aka ORDER BY item_id'),
      fts: db.all('SELECT id FROM items_fts ORDER BY id'),
    });
    db.close();
    return out;
  };

  let firstDump;
  await testAsync('rm + re-hydrate is idempotent', async () => {
    firstDump = dump();
    rmSync(dbPath);
    await hydrate({ root, dbPath });
    assert.equal(dump(), firstDump, 'logical content must match exactly');
  });

  test('open query returns the two open tickets', () => {
    const db = engine(dbPath);
    const rows = db.all("SELECT id FROM items WHERE status IN ('todo','doing','review') AND store='tickets' ORDER BY id");
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-T001', 'TST-T002']);
  });

  test('children-of query (downward view from upward parent)', () => {
    const db = engine(dbPath);
    const rows = db.all('SELECT id FROM items WHERE parent = ?', ['TST-T001']);
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-T002']);
  });

  test('backlinks: D001 is linked from T001', () => {
    const db = engine(dbPath);
    const rows = db.all('SELECT from_id FROM links WHERE to_id = ?', ['TST-D001']);
    db.close();
    assert.ok(rows.some((r) => r.from_id === 'TST-T001'));
  });

  test('FTS exact-token match (no stemming)', () => {
    const db = engine(dbPath);
    const rows = db.all("SELECT id FROM items_fts WHERE items_fts MATCH 'engine' ORDER BY id");
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-T001'], "'engine' is only in T001's body");
  });

  test('FTS prefix match spans title + body across items', () => {
    const db = engine(dbPath);
    const rows = db.all("SELECT id FROM items_fts WHERE items_fts MATCH 'widget*' ORDER BY id");
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-D001', 'TST-T001'], 'widget* hits the ticket and the decision');
  });

  test('next-id is max(num)+1', () => {
    const db = engine(dbPath);
    const row = db.all("SELECT MAX(num) m FROM items WHERE scope='TST' AND store='tickets'")[0];
    db.close();
    assert.equal((row.m || 0) + 1, 3);
  });

  test('history materialized into the rollup table', () => {
    const db = engine(dbPath);
    const rows = db.all('SELECT event FROM history WHERE item_id = ?', ['TST-T002']);
    db.close();
    assert.deepEqual(rows.map((r) => r.event), ['created']);
  });

  // ---- parity: cache-backed == markdown-scan (KIT-T026) -------------------
  // The consumers we routed to the cache (next-id, orient, drain via q.mjs) MUST get the
  // SAME answer the markdown scan gives. `query(cmd, args, {root})` uses the cache;
  // `{root, noDb:true}` forces the db-parse scan — the exact fallback. Equal => correct.
  // JSON round-trip normalizes shape (node:sqlite hands back null-prototype rows; the scan
  // builds plain objects) — the same serialization an agent/CLI consumer sees, so equality
  // here is the equality that matters. Values, keys, and order must match; prototype must not.
  const norm = (rows) => JSON.parse(JSON.stringify(rows));
  const parity = async (cmd, args) => {
    const cache = norm((await query(cmd, args, { root, dbPath })).rows);
    const scan = norm((await query(cmd, args, { root, dbPath, noDb: true })).rows);
    return { cache, scan };
  };

  await testAsync('parity: open (cache == scan)', async () => {
    const { cache, scan } = await parity('open', []);
    assert.deepEqual(cache, scan, 'cache-backed open must equal the markdown scan');
    assert.deepEqual(cache.map((r) => r.id), ['TST-T002', 'TST-T001'], 'critical sorts before high');
  });

  await testAsync('parity: rundown (cache == scan)', async () => {
    const { cache, scan } = await parity('rundown', []);
    assert.deepEqual(cache, scan, 'cache-backed rundown must equal the markdown scan');
  });

  await testAsync('parity: next-id (cache == scan == nextId())', async () => {
    const { cache, scan } = await parity('next-id', ['TST', 'tickets']);
    assert.deepEqual(cache, scan, 'cache-backed next-id must equal the markdown scan');
    assert.equal(cache[0].id, 'TST-T003', 'next ticket id is max(num)+1, formatted');
    // and identical to the standalone scan allocator that next-id.mjs falls back to
    assert.equal(cache[0].id, nextId(root, 'tickets'));
  });

  // ---- cross-scope hydration (KIT-T031) -----------------------------------
  // The single shared DB must index EVERY registered scope, queryable from any cwd — the bug
  // was last-writer-wins per repo. Register two projects (distinct synthetic scope keys that
  // can't collide with the real claude-kit stores hydrationSources also unions in), hydrate
  // with no --root, and assert BOTH temp scopes are present + queryable in the one DB.
  await testAsync('cross-scope hydrate unions every registered scope', async () => {
    const xroot = mkdtempSync(join(tmpdir(), 'kit-xscope-'));
    const mkScope = (name, key) => {
      const repo = join(xroot, name);
      const ai = join(repo, '.ai');
      mkdirSync(join(ai, 'tickets'), { recursive: true });
      writeFileSync(join(ai, 'config.yml'), `ids:\n  key: "${key}"\n  pad: 3\n`);
      writeFileSync(join(ai, 'tickets', `${key}-T001-x.md`),
        `---\nid: ${key}-T001\ntitle: ${name} ticket\ntype: feature\nstatus: doing\npriority: high\n---\nbody\n`);
      writeFileSync(join(ai, 'tickets', `${key}-T002-y.md`),
        `---\nid: ${key}-T002\ntitle: ${name} second\ntype: bug\nstatus: todo\npriority: low\n---\nbody\n`);
      return repo;
    };
    // Synthetic keys (not KIT/HOD) so the assertion is exact even though hydrationSources also
    // unions in the live claude-kit .ai — proving union, not isolation.
    const registry = join(xroot, 'registry.json');
    writeFileSync(registry, JSON.stringify({
      dataRoot: null,
      projects: { 'proj-a': mkScope('proj-a', 'XSA'), 'proj-b': mkScope('proj-b', 'XSB') },
    }));

    // hydrationSources reads the registry through lib.mjs's CLAUDE_KIT_REGISTRY override,
    // resolved at call time so this in-process set takes effect.
    const prev = process.env.CLAUDE_KIT_REGISTRY;
    process.env.CLAUDE_KIT_REGISTRY = registry;
    const xdb = join(xroot, '.cache', 'workflow.db');
    try {
      const r = await hydrate({ dbPath: xdb }); // no root → cross-scope
      assert.ok(r.ok, 'cross-scope hydrate should succeed');
      assert.ok(r.scopes >= 3, 'unions both temp scopes + claude-kit itself');

      const db = engine(xdb);
      const byScope = Object.fromEntries(
        db.all("SELECT scope, COUNT(*) n FROM items WHERE scope IN ('XSA','XSB') GROUP BY scope")
          .map((s) => [s.scope, s.n]));
      const ids = db.all("SELECT id FROM items WHERE scope IN ('XSA','XSB') ORDER BY id").map((x) => x.id);
      const aNext = db.all("SELECT MAX(num) m FROM items WHERE scope='XSA' AND store='tickets'")[0];
      db.close();

      assert.equal(byScope.XSA, 2, 'scope XSA present in one DB');
      assert.equal(byScope.XSB, 2, 'scope XSB present in the SAME DB (cross-scope union)');
      assert.deepEqual(ids, ['XSA-T001', 'XSA-T002', 'XSB-T001', 'XSB-T002'], 'both scopes queryable');
      assert.equal((aNext.m || 0) + 1, 3, 'next-id derives from the right scope cross-scope');
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_KIT_REGISTRY;
      else process.env.CLAUDE_KIT_REGISTRY = prev;
      rmSync(xroot, { recursive: true, force: true });
    }
  });

  // --root still isolates to a single scope (regression guard for the override).
  await testAsync('single-root --root hydrate stays single-scope', async () => {
    const r = await hydrate({ root, dbPath });
    assert.equal(r.items, 3, 'explicit --root hydrates only that one store');
  });
}

rmSync(root, { recursive: true, force: true });

console.log(`\ndb-cache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
