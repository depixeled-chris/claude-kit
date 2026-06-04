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
}

rmSync(root, { recursive: true, force: true });

console.log(`\ndb-cache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
