#!/usr/bin/env node
// Tests for the KIT-T004 SQLite query cache: parse → hydrate → query, idempotency, and
// the markdown-scan fallback. Builds a throwaway .ai store in a temp dir so the test is
// hermetic (no dependency on the live claude-kit stores). Skips the SQLite-backed half if
// no engine is present — the cache is optional, and so is testing it.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { collectItems } from './db-parse.mjs';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';
import { query } from './q.mjs';
import { nextId } from './id-utils.mjs';
import { reconcileSupersede } from './reconcile-supersede.mjs';

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
  `---\nid: TST-T001\ntitle: root ticket about widgets\ntype: feature\nstatus: superseded\npriority: high\nlinks: [TST-D001]\nsuperseded_by: TST-T003\n---\n## Description\nthe widget engine\n`);
// T002 doubles as the regression fixture: regressed_from + causing/fixed commits drive the
// KIT-T026 by-commit / regressions parity tests (and the introduced_by edge on T001).
writeFileSync(join(ai, 'tickets', 'TST-T002-child.md'),
  `---\nid: TST-T002\ntitle: child of root\ntype: bug\nstatus: todo\npriority: critical\nparent: TST-T001\naka: [OLD-9]\nregressed_from: TST-T001\ncausing_commit: deadbee\nfixed_commit: cafef00\n---\n## History\n- [2026-06-04 10:00] (created) opened\n`);
writeFileSync(join(ai, 'decisions', 'TST-D001.md'),
  `---\nid: TST-D001\ntitle: use widgets\ndate: 2026-06-04\n---\n**Decision:** widgets it is\n`);
// T003 supersedes T001 (KIT-T024): T003 is the live replacement; T001 is retired via
// superseded_by + status. Drives the supersede-chain + active-set-exclusion tests.
writeFileSync(join(ai, 'tickets', 'TST-T003-rewrite.md'),
  `---\nid: TST-T003\ntitle: rewrite the widget engine\ntype: feature\nstatus: todo\npriority: high\nsupersedes: TST-T001\n---\n## Description\na better widget engine\n`);

// ---- pure parse (always runs) ---------------------------------------------
const items = collectItems(root);
test('collectItems finds all four items', () => assert.equal(items.length, 4));
test('scope derived from id prefix', () => assert.equal(items.find((i) => i.id === 'TST-T001').scope, 'TST'));
test('parent edge parsed', () => assert.equal(items.find((i) => i.id === 'TST-T002').parent, 'TST-T001'));
test('aka parsed', () => assert.deepEqual(items.find((i) => i.id === 'TST-T002').aka, ['OLD-9']));
test('history event parsed', () => {
  const h = items.find((i) => i.id === 'TST-T002').history;
  assert.equal(h.length, 1);
  assert.equal(h[0].event, 'created');
});
test('num parsed for next-id', () => assert.equal(Math.max(...items.filter((i) => i.store === 'tickets').map((i) => i.num)), 3));

// supersede frontmatter parsed (KIT-T024)
test('supersedes parsed on the newer ticket', () => assert.equal(items.find((i) => i.id === 'TST-T003').supersedes, 'TST-T001'));
test('superseded_by parsed on the retired ticket', () => assert.equal(items.find((i) => i.id === 'TST-T001').supersededBy, 'TST-T003'));

// ---- auto-reconcile of supersede (KIT-D021/KIT-T024) ----------------------
// Hermetic temp .ai: declare a supersede on ONLY the `supersedes` side and prove the
// reconcile auto-writes the reciprocal `superseded_by`, flips the retired ticket to
// `status: superseded`, is idempotent, and that the retired ticket then drops out of
// `q.mjs open`. Engine-independent (pure fs + the scan path).
async function reconcileTests() {
  const rroot = mkdtempSync(join(tmpdir(), 'kit-recon-'));
  const rai = join(rroot, '.ai');
  mkdirSync(join(rai, 'tickets'), { recursive: true });
  writeFileSync(join(rai, 'config.yml'), 'ids:\n  key: "RCN"\n  pad: 3\n');
  const oldPath = join(rai, 'tickets', 'RCN-T001-old.md');
  const newPath = join(rai, 'tickets', 'RCN-T002-new.md');
  // Old ticket: still `todo`, NO superseded_by pointer (the one-sided case to reconcile).
  writeFileSync(oldPath,
    `---\nid: RCN-T001\ntitle: old widget plan\ntype: feature\nstatus: todo\npriority: high\nsuperseded_by:\n---\n## Description\nfirst attempt\n`);
  // New ticket declares the relationship on the `supersedes` side only.
  writeFileSync(newPath,
    `---\nid: RCN-T002\ntitle: better widget plan\ntype: feature\nstatus: todo\npriority: high\nsupersedes: RCN-T001\n---\n## Description\nsecond attempt\n`);

  const field = (text, key) => (text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm')) || [, ''])[1].trim();

  const first = reconcileSupersede(rroot);
  test('reconcile reports the changes it made', () =>
    assert.ok(first.changed.length >= 2, `expected >=2 changes, got ${first.changed.length}`));

  const oldAfter = readFileSync(oldPath, 'utf8');
  test('reconcile writes the reciprocal superseded_by on the retired ticket', () =>
    assert.equal(field(oldAfter, 'superseded_by'), 'RCN-T002'));
  test('reconcile flips the retired ticket to status: superseded', () =>
    assert.equal(field(oldAfter, 'status'), 'superseded'));
  test('reconcile leaves the live replacement status untouched', () =>
    assert.equal(field(readFileSync(newPath, 'utf8'), 'status'), 'todo'));

  // Idempotency: a second run changes nothing and rewrites no bytes.
  const oldBytes = readFileSync(oldPath, 'utf8');
  const newBytes = readFileSync(newPath, 'utf8');
  const second = reconcileSupersede(rroot);
  test('second reconcile run is a no-op (idempotent)', () =>
    assert.equal(second.changed.length, 0, `expected 0 changes, got ${second.changed.join('; ')}`));
  test('idempotent reconcile rewrites no file content', () => {
    assert.equal(readFileSync(oldPath, 'utf8'), oldBytes);
    assert.equal(readFileSync(newPath, 'utf8'), newBytes);
  });

  // The retired ticket is now excluded from the open/drain set (markdown-scan path).
  await testAsync('retired ticket excluded from q.mjs open after reconcile', async () => {
    const { rows } = await query('open', [], { root: rroot, noDb: true });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes('RCN-T002'), 'the live replacement stays open');
    assert.ok(!ids.includes('RCN-T001'), 'the retired ticket drops out of the drain');
  });

  rmSync(rroot, { recursive: true, force: true });
}
await reconcileTests();

// ---- SQLite-backed (skipped when no engine) -------------------------------
const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — fallback-only environment)');
} else {
  const dbPath = join(root, '.cache', 'workflow.db');

  await testAsync('hydrate builds the db', async () => {
    const r = await hydrate({ root, dbPath });
    assert.ok(r.ok && existsSync(dbPath), 'db should exist');
    assert.equal(r.items, 4);
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

  test('open query returns the two non-superseded open tickets', () => {
    const db = engine(dbPath);
    const rows = db.all("SELECT id FROM items WHERE status IN ('todo','doing','review') AND store='tickets' ORDER BY id");
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-T002', 'TST-T003'], 'T001 is superseded → not in flow statuses');
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
    assert.deepEqual(rows.map((r) => r.id), ['TST-T001', 'TST-T003'], "'engine' is in T001's and T003's bodies");
  });

  test('FTS prefix match spans title + body across items', () => {
    const db = engine(dbPath);
    const rows = db.all("SELECT id FROM items_fts WHERE items_fts MATCH 'widget*' ORDER BY id");
    db.close();
    assert.deepEqual(rows.map((r) => r.id), ['TST-D001', 'TST-T001', 'TST-T003'], 'widget* hits both tickets and the decision');
  });

  test('next-id is max(num)+1', () => {
    const db = engine(dbPath);
    const row = db.all("SELECT MAX(num) m FROM items WHERE scope='TST' AND store='tickets'")[0];
    db.close();
    assert.equal((row.m || 0) + 1, 4);
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

  await testAsync('parity: open excludes superseded (cache == scan)', async () => {
    const { cache, scan } = await parity('open', []);
    assert.deepEqual(cache, scan, 'cache-backed open must equal the markdown scan');
    assert.deepEqual(cache.map((r) => r.id), ['TST-T002', 'TST-T003'],
      'T001 (superseded) is dropped; critical T002 sorts before high T003');
  });

  await testAsync('parity: rundown (cache == scan)', async () => {
    const { cache, scan } = await parity('rundown', []);
    assert.deepEqual(cache, scan, 'cache-backed rundown must equal the markdown scan');
  });

  await testAsync('parity: next-id (cache == scan == nextId())', async () => {
    const { cache, scan } = await parity('next-id', ['TST', 'tickets']);
    assert.deepEqual(cache, scan, 'cache-backed next-id must equal the markdown scan');
    assert.equal(cache[0].id, 'TST-T004', 'next ticket id is max(num)+1, formatted');
    // and identical to the standalone scan allocator that next-id.mjs falls back to
    assert.equal(cache[0].id, nextId(root, 'tickets'));
  });

  // ---- commit↔ticket cross-ref + REGRESSIONS parity (KIT-T026) ------------
  // by-commit and the index-tickets `regressions` source MUST agree cache-vs-scan, and
  // the commit edges must resolve to the right tickets (caused_by vs fixed_by).
  await testAsync('parity: by-commit caused_by (cache == scan)', async () => {
    const { cache, scan } = await parity('by-commit', ['deadbee']);
    assert.deepEqual(cache, scan, 'cache-backed by-commit must equal the markdown scan');
    assert.deepEqual(cache, [{ id: 'TST-T002', type: 'bug', status: 'todo', rel: 'caused_by', title: 'child of root' }],
      'deadbee is T002s causing commit');
  });

  await testAsync('parity: by-commit fixed_by (cache == scan)', async () => {
    const { cache, scan } = await parity('by-commit', ['cafef00']);
    assert.deepEqual(cache, scan, 'cache-backed by-commit must equal the markdown scan');
    assert.deepEqual(cache.map((r) => r.rel), ['fixed_by'], 'cafef00 is T002s fixing commit');
  });

  await testAsync('parity: regressions (cache == scan, drives index-tickets REGRESSIONS.md)', async () => {
    const { cache, scan } = await parity('regressions', []);
    assert.deepEqual(cache, scan, 'cache-backed regressions must equal the markdown scan');
    const t2 = cache.find((r) => r.id === 'TST-T002');
    assert.deepEqual(
      { regressed_from: t2.regressed_from, causing_commit: t2.causing_commit, fixed_commit: t2.fixed_commit },
      { regressed_from: 'TST-T001', causing_commit: 'deadbee', fixed_commit: 'cafef00' },
      'T002 carries its regression chain + commit refs through the cache');
  });

  // ---- supersede + dedup (KIT-T024) ---------------------------------------
  await testAsync('parity: supersedes chain data (cache == scan, drives SUPERSEDED.md)', async () => {
    const { cache, scan } = await parity('supersedes', []);
    assert.deepEqual(cache, scan, 'cache-backed supersedes must equal the markdown scan');
    const t3 = cache.find((r) => r.id === 'TST-T003');
    assert.equal(t3.supersedes, 'TST-T001', 'T003 retires T001');
    const t2 = cache.find((r) => r.id === 'TST-T002');
    assert.equal(t2.supersedes, null, 'a normal ticket supersedes nothing');
  });

  await testAsync('supersede edge hydrated both directions', () => {
    const db = engine(dbPath);
    const fwd = db.all("SELECT to_id FROM links WHERE from_id='TST-T003' AND rel='supersedes'");
    const back = db.all("SELECT to_id FROM links WHERE from_id='TST-T001' AND rel='superseded_by'");
    db.close();
    assert.deepEqual(fwd.map((r) => r.to_id), ['TST-T001'], 'newer→older supersedes edge');
    assert.deepEqual(back.map((r) => r.to_id), ['TST-T003'], 'older→newer superseded_by edge');
  });

  await testAsync('parity: similar surfaces likely duplicates (cache == scan, suggest-only)', async () => {
    const { cache, scan } = await parity('similar', ['widget', 'engine']);
    assert.deepEqual(cache, scan, 'cache-backed similar must equal the markdown scan');
    const ids = cache.map((r) => r.id);
    assert.ok(ids.includes('TST-T003'), 'the live widget-engine ticket is surfaced as a candidate');
    assert.ok(!ids.includes('TST-T001'), 'an already-superseded ticket is NOT suggested as a duplicate');
    assert.ok(ids.every((id) => id.startsWith('TST-T')), 'only tickets are candidates (decisions excluded)');
  });

  await testAsync('similar returns nothing for an empty proposal (no false candidates)', async () => {
    const { cache } = await parity('similar', ['', '']);
    assert.deepEqual(cache, [], 'a blank proposal surfaces no candidates');
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
    assert.equal(r.items, 4, 'explicit --root hydrates only that one store');
  });
}

rmSync(root, { recursive: true, force: true });

console.log(`\ndb-cache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
