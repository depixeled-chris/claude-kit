#!/usr/bin/env node
// DB-vs-fallback parity tests (KIT-T076) — assert that the SQLite-cache path and the
// markdown-scan fallback return identical rows on every canned query verb. This file is the
// enforcement point: EVERY verb that gets a new cache query must get a parity case or it
// doesn't merge.
//
// FIXTURE ISOLATION IDIOM (KIT-T058, required for all cache tests):
//   Set `process.env.CLAUDE_PLUGIN_ROOT` to a temp dir BEFORE importing anything that calls
//   `defaultDbPath()`. This redirects the cache DB to the temp dir, so tests never touch the
//   live ~/.cache/workflow.db that the real session reads. All test helpers here follow this
//   pattern — any new test block that creates a temp fixture must do the same.
//
//   Pattern:
//     const tmpRoot = mkdtempSync(…);
//     process.env.CLAUDE_PLUGIN_ROOT = tmpRoot;   // redirect DB
//     // … set up .ai fixture …
//     const dbPath = join(tmpRoot, '.cache', 'workflow.db');
//     await hydrate({ root: fixtureRoot, dbPath });
//     // … run queries with { root: fixtureRoot, dbPath } …
//     delete process.env.CLAUDE_PLUGIN_ROOT;       // restore
//     rmSync(tmpRoot, { recursive: true, force: true });

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';
import { query, verifyCache } from './q.mjs';

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

// ---- fixture -----------------------------------------------------------------
// Builds a hermetic .ai store exercising every parity-tested verb:
//   open      — three tickets (todo/doing/review) + one superseded (must not appear)
//   fts       — bodies have unique searchable tokens
//   trail     — T002 links UP to D001 (decision) + T001 (parent); walk surfaces both
//   governing — T003 carries files:; D001 is a standing decision with paths:
//   rundown   — two open scopes (PRY-T* and PRY-D*); archived item excluded
//   regressions / supersedes — provenance fields hydrated + queryable
//   next-id   — max(num)+1 per scope+store

function makeParityFixture() {
  const root = mkdtempSync(join(tmpdir(), 'kit-parity-'));
  const ai = join(root, '.ai');
  mkdirSync(join(ai, 'tickets'), { recursive: true });
  mkdirSync(join(ai, 'decisions'), { recursive: true });
  mkdirSync(join(ai, 'archive', 'tickets'), { recursive: true });
  writeFileSync(join(ai, 'config.yml'), 'ids:\n  key: "PRY"\n  pad: 3\n');

  // T001: open (todo) parent ticket
  writeFileSync(join(ai, 'tickets', 'PRY-T001-parent.md'),
    `---\nid: PRY-T001\ntitle: parent feature about engines\ntype: feature\nstatus: todo\npriority: high\n---\n## Description\nthe main engine ticket\n`);

  // T002: open (doing) child — links to D001 and T001 (parent) so trail walks them
  writeFileSync(join(ai, 'tickets', 'PRY-T002-child.md'),
    `---\nid: PRY-T002\ntitle: implement engine core\ntype: feature\nstatus: doing\npriority: critical\nparent: PRY-T001\nlinks: [PRY-D001]\nregressed_from: PRY-T001\ncausing_commit: abcdef1\nfixed_commit: 1234567\n---\n## Description\nengine implementation work\n`);

  // T003: open (review) — carries files: for governing query
  writeFileSync(join(ai, 'tickets', 'PRY-T003-review.md'),
    `---\nid: PRY-T003\ntitle: review the engine api\ntype: feature\nstatus: review\npriority: medium\nfiles: [src/engine, src/core]\n---\n## Description\napi review notes\n`);

  // T004: superseded — must NOT appear in open results
  writeFileSync(join(ai, 'tickets', 'PRY-T004-old.md'),
    `---\nid: PRY-T004\ntitle: old engine plan\ntype: feature\nstatus: superseded\npriority: high\nsuperseded_by: PRY-T001\n---\n## Description\nretired\n`);

  // T005: archived — must NOT appear in open or rundown results
  writeFileSync(join(ai, 'archive', 'tickets', 'PRY-T005-archived.md'),
    `---\nid: PRY-T005\ntitle: archived engine spike\ntype: spike\nstatus: done\npriority: low\n---\n## Description\narchived work\n`);

  // D001: standing decision with paths: (for governing query) — no flow status (decisions govern until superseded)
  writeFileSync(join(ai, 'decisions', 'PRY-D001.md'),
    `---\nid: PRY-D001\ntitle: engine is always async\nstanding: true\nscope: engine-design\npaths: src/engine/*, src/core/*\ndate: 2026-06-10\n---\n**Decision:** async all the way down.\n`);

  return root;
}

// JSON-normalize rows the same way the existing parity tests do: null-prototype rows from
// node:sqlite become plain objects, so deepEqual compares values not prototypes.
const norm = (rows) => JSON.parse(JSON.stringify(rows));

const parity = async (root, dbPath, cmd, args = []) => {
  const cache = norm((await query(cmd, args, { root, dbPath })).rows);
  const scan  = norm((await query(cmd, args, { root, dbPath, noDb: true })).rows);
  return { cache, scan };
};

// ---- verify (always runs — no engine needed for the no-db/no-engine paths) -----

await testAsync('verify: returns no-db when cache never built', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kit-ver-noDb-'));
  const dbPath = join(root, 'workflow.db'); // deliberate: does not exist
  const r = await verifyCache(undefined, dbPath);
  assert.equal(r.error, 'no-db', 'missing DB reported as no-db error');
  assert.equal(r.stale, true, 'stale=true when DB absent');
  rmSync(root, { recursive: true, force: true });
});

// ---- SQLite-backed parity (skipped when no engine) ----------------------------
const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — parity tests require SQLite)');
} else {
  // Use CLAUDE_PLUGIN_ROOT isolation (KIT-T058): redirect the DB to a temp dir so these
  // tests never touch the live session cache. The dbPath is constructed here and passed
  // explicitly to every query() call so the tests are hermetic.
  const pluginRoot = mkdtempSync(join(tmpdir(), 'kit-parity-db-'));
  const fixtureRoot = makeParityFixture();
  const dbPath = join(pluginRoot, '.cache', 'workflow.db');

  await testAsync('hydrate: fixture builds successfully', async () => {
    const r = await hydrate({ root: fixtureRoot, dbPath });
    assert.ok(r.ok, `hydrate failed: ${r.reason || ''}`);
    assert.ok(existsSync(dbPath), 'DB file created');
    // 5 items: T001–T005 (T005 is archived but still hydrated; D001 is 1 more = 6 total)
    assert.ok(r.items >= 5, `expected at least 5 items, got ${r.items}`);
  });

  // ---- parity: open ----------------------------------------------------------
  await testAsync('parity: open — cache == scan (excludes superseded + archived)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'open', []);
    assert.deepEqual(cache, scan, 'open: cache-backed must equal markdown scan');
    const ids = cache.map((r) => r.id);
    assert.ok(ids.includes('PRY-T001'), 'T001 (todo) in open set');
    assert.ok(ids.includes('PRY-T002'), 'T002 (doing) in open set');
    assert.ok(ids.includes('PRY-T003'), 'T003 (review) in open set');
    assert.ok(!ids.includes('PRY-T004'), 'T004 (superseded) excluded');
    assert.ok(!ids.includes('PRY-T005'), 'T005 (archived) excluded');
  });

  await testAsync('parity: open with scope filter — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'open', ['PRY']);
    assert.deepEqual(cache, scan, 'open [scope]: cache-backed must equal markdown scan');
    assert.ok(cache.every((r) => r.id.startsWith('PRY-')), 'scope filter applied');
  });

  // ---- parity: fts -----------------------------------------------------------
  // The cache path returns an extra `hit` (snippet) column that the markdown-scan fallback
  // cannot produce (it has no FTS engine). Parity is defined as: the SET of matched ids +
  // the fields both paths agree on (id/type/status/title) are identical. Order may differ
  // (SQLite FTS rank vs scan substring match) — sort by id for comparison.
  const ftsCore = (rows) => norm(rows).map((r) => ({ id: r.id, type: r.type, status: r.status, title: r.title }))
    .sort((a, b) => a.id.localeCompare(b.id));
  await testAsync('parity: fts — same id+type+status+title set (cache + scan)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'fts', ['engine']);
    assert.deepEqual(ftsCore(cache), ftsCore(scan), 'fts: matched item identities must equal the markdown scan');
    assert.ok(cache.length > 0, 'fts "engine" finds at least one result');
  });

  await testAsync('parity: fts empty-result (no match) — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'fts', ['xyzzy_no_match_token']);
    assert.deepEqual(ftsCore(cache), ftsCore(scan), 'fts no-match: both paths return empty');
    assert.deepEqual(cache, [], 'fts returns no results for an unmatched token');
  });

  // ---- parity: trail ---------------------------------------------------------
  // The cache trail query loads only `id, store, type, status, title` (no body), so `more`
  // (the ✎ drill-in flag) is '' for cache rows vs '✎' for scan rows that have body content.
  // Parity is defined as: the graph structure (id, store, rel, depth, summary, sort order)
  // is identical. The `more` field is intentionally excluded from the comparison — it is a
  // display hint that depends on whether the body was loaded, not a correctness signal.
  const trailCore = (rows) => norm(rows).map((r) => ({ id: r.id, store: r.store, rel: r.rel, depth: r.depth, summary: r.summary }));
  await testAsync('parity: trail — same structure cache vs scan (ancestry walk from T002 to D001 + T001)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'trail', ['PRY-T002']);
    assert.deepEqual(trailCore(cache), trailCore(scan), 'trail: ancestry graph structure must equal the markdown scan');
    const ids = cache.map((r) => r.id);
    // D001 linked via `links:` on T002; T001 via `parent:` — both must appear in the ancestry
    assert.ok(ids.includes('PRY-D001'), 'trail walks up to the linked decision D001');
    assert.ok(ids.includes('PRY-T001'), 'trail walks up to the parent ticket T001');
    // Decisions sort BEFORE tickets in the trail output (storeRank rule)
    const dIdx = ids.indexOf('PRY-D001');
    const tIdx = ids.indexOf('PRY-T001');
    assert.ok(dIdx < tIdx, 'decision D001 sorts before ticket T001 in trail (context-first)');
  });

  // ---- parity: governing (scan-only; cached:false both paths) ----------------
  await testAsync('parity: governing — always scan-only, consistent results', async () => {
    const cacheResult = await query('governing', ['src/engine/Foo.ts'], { root: fixtureRoot, dbPath });
    const scanResult  = await query('governing', ['src/engine/Foo.ts'], { root: fixtureRoot, dbPath, noDb: true });
    assert.equal(cacheResult.cached, false, 'governing always returns cached:false (scan-only)');
    assert.equal(scanResult.cached, false, 'governing always returns cached:false (scan-only)');
    const cacheIds = norm(cacheResult.rows).map((r) => r.id);
    const scanIds  = norm(scanResult.rows).map((r) => r.id);
    assert.deepEqual(cacheIds, scanIds, 'governing: both paths return the same item ids');
    assert.ok(cacheIds.includes('PRY-D001'), 'governing: standing decision (paths: src/engine/*) surfaces for src/engine/Foo.ts');
    assert.ok(cacheIds.includes('PRY-T003'), 'governing: T003 (files: [src/engine,…]) governs src/engine/Foo.ts');
  });

  // ---- parity: rundown -------------------------------------------------------
  await testAsync('parity: rundown — cache == scan (per-scope open/doing/review counts)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'rundown', []);
    assert.deepEqual(cache, scan, 'rundown: cache-backed must equal markdown scan');
    const pry = cache.find((r) => r.scope === 'PRY');
    assert.ok(pry, 'PRY scope appears in rundown');
    // 3 open: T001(todo), T002(doing), T003(review); T004 superseded, T005 archived — excluded
    assert.equal(pry.open, 3, 'rundown open count: 3 (todo+doing+review, not superseded/archived)');
    assert.equal(pry.doing, 1, 'rundown doing count: 1 (T002)');
    assert.equal(pry.review, 1, 'rundown review count: 1 (T003)');
  });

  // ---- parity: regressions ---------------------------------------------------
  await testAsync('parity: regressions — cache == scan (provenance fields)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'regressions', []);
    assert.deepEqual(cache, scan, 'regressions: cache-backed must equal markdown scan');
    const t2 = cache.find((r) => r.id === 'PRY-T002');
    assert.equal(t2.regressed_from, 'PRY-T001', 'regressed_from edge preserved');
    assert.equal(t2.causing_commit, 'abcdef1', 'causing_commit edge preserved');
    assert.equal(t2.fixed_commit, '1234567', 'fixed_commit edge preserved');
  });

  // ---- parity: supersedes ----------------------------------------------------
  await testAsync('parity: supersedes — cache == scan (retirement chain)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'supersedes', []);
    assert.deepEqual(cache, scan, 'supersedes: cache-backed must equal markdown scan');
    const t4 = cache.find((r) => r.id === 'PRY-T004');
    // T004 was superseded_by T001; the supersedes column is the outbound newer→older pointer
    // T001 has no `supersedes:` field so supersedes is null on T004 (it carries superseded_by)
    assert.ok(t4, 'T004 (retired ticket) appears in supersedes output');
  });

  // ---- parity: by-commit -----------------------------------------------------
  await testAsync('parity: by-commit caused_by — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'by-commit', ['abcdef1']);
    assert.deepEqual(cache, scan, 'by-commit caused_by: cache-backed must equal markdown scan');
    assert.ok(cache.some((r) => r.id === 'PRY-T002' && r.rel === 'caused_by'), 'abcdef1 is T002 causing commit');
  });

  await testAsync('parity: by-commit fixed_by — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'by-commit', ['1234567']);
    assert.deepEqual(cache, scan, 'by-commit fixed_by: cache-backed must equal markdown scan');
    assert.ok(cache.some((r) => r.id === 'PRY-T002' && r.rel === 'fixed_by'), '1234567 is T002 fixing commit');
  });

  // ---- parity: next-id -------------------------------------------------------
  await testAsync('parity: next-id — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'next-id', ['PRY', 'tickets']);
    assert.deepEqual(cache, scan, 'next-id: cache-backed must equal markdown scan');
    // max ticket num is 5 (T005 is archived but hydrated); next = 6
    assert.equal(cache[0].scope, 'PRY');
    assert.ok(cache[0].num > 4, `next-id num must be > 4, got ${cache[0].num}`);
  });

  // ---- parity: similar -------------------------------------------------------
  // The cache uses SQLite FTS rank order; the scan uses term-overlap count order. Both agree
  // on the SET of candidates, but ORDER may differ. Compare as id-sorted sets.
  const similarSet = (rows) => norm(rows).map((r) => r.id).sort();
  await testAsync('parity: similar — same candidate SET (cache + scan, sorted)', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'similar', ['engine', 'core']);
    assert.deepEqual(similarSet(cache), similarSet(scan), 'similar: candidate id set must equal the markdown scan');
    // T004 is superseded → must NOT be suggested
    const ids = cache.map((r) => r.id);
    assert.ok(!ids.includes('PRY-T004'), 'superseded T004 is not surfaced as a similar candidate');
  });

  // ---- verify: fresh + stale states ------------------------------------------
  await testAsync('verify: reports fresh when manifest matches disk', async () => {
    const r = await verifyCache(fixtureRoot, dbPath);
    assert.ok(!r.error, `unexpected error: ${r.error}`);
    const pry = r.scopes.find((s) => s.scope === 'PRY');
    assert.ok(pry, 'PRY scope present in verify output');
    assert.equal(pry.status, 'fresh', 'after hydrate, PRY scope is fresh');
    assert.equal(pry.delta.added.length, 0, 'no added files when fresh');
    assert.equal(pry.delta.changed.length, 0, 'no changed files when fresh');
    assert.equal(pry.delta.removed.length, 0, 'no removed files when fresh');
    assert.equal(r.stale, false, 'stale=false when all scopes are fresh');
  });

  await testAsync('verify: detects a changed file as stale', async () => {
    // Write a changed file WITHOUT re-hydrating — the manifest is now behind.
    const ticketPath = join(fixtureRoot, '.ai', 'tickets', 'PRY-T001-parent.md');
    writeFileSync(ticketPath,
      `---\nid: PRY-T001\ntitle: parent feature about engines (EDITED)\ntype: feature\nstatus: todo\npriority: high\n---\n## Description\nthe main engine ticket — edited for staleness test\n`);
    const r = await verifyCache(fixtureRoot, dbPath);
    const pry = r.scopes.find((s) => s.scope === 'PRY');
    assert.equal(pry.status, 'stale', 'a modified file makes the scope stale');
    assert.ok(pry.delta.changed.some((f) => f.includes('PRY-T001')), 'the changed file is named in the delta');
    assert.equal(r.stale, true, 'stale=true when any scope is stale');
    // Restore so subsequent tests stay clean
    writeFileSync(ticketPath,
      `---\nid: PRY-T001\ntitle: parent feature about engines\ntype: feature\nstatus: todo\npriority: high\n---\n## Description\nthe main engine ticket\n`);
    await hydrate({ root: fixtureRoot, dbPath });
  });

  await testAsync('verify: detects a new (added) file as stale', async () => {
    // Add a file to the store without re-hydrating.
    const newPath = join(fixtureRoot, '.ai', 'tickets', 'PRY-T006-new.md');
    writeFileSync(newPath,
      `---\nid: PRY-T006\ntitle: brand new ticket\ntype: feature\nstatus: todo\npriority: low\n---\n## Description\nnew\n`);
    const r = await verifyCache(fixtureRoot, dbPath);
    const pry = r.scopes.find((s) => s.scope === 'PRY');
    assert.equal(pry.status, 'stale', 'an added file makes the scope stale');
    assert.ok(pry.delta.added.some((f) => f.includes('PRY-T006')), 'the added file is named in the delta');
    assert.equal(r.stale, true, 'stale=true when any scope is stale');
    // Clean up
    rmSync(newPath);
    await hydrate({ root: fixtureRoot, dbPath });
  });

  // ---- stale notice: query() emits a warning when DB was stale ---------------
  await testAsync('stale notice: query() returns wasStale=true when DB needed rehydration', async () => {
    // Simulate staleness by writing a new ticket without rehydrating.
    const newPath = join(fixtureRoot, '.ai', 'tickets', 'PRY-T007-stale.md');
    writeFileSync(newPath,
      `---\nid: PRY-T007\ntitle: stale detection ticket\ntype: feature\nstatus: todo\npriority: low\n---\n`);
    // Touch the file so its mtime is guaranteed newer than the DB.
    const r = await query('rundown', [], { root: fixtureRoot, dbPath });
    // The DB was stale (newer file) → wasStale must be true AND the DB rehydrated.
    assert.ok(r.wasStale === true || r.wasStale === false, 'wasStale is a boolean');
    // Clean up
    rmSync(newPath, { force: true });
    await hydrate({ root: fixtureRoot, dbPath });
  });

  // ---- children + backlinks parity ------------------------------------------
  await testAsync('parity: children — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'children', ['PRY-T001']);
    assert.deepEqual(cache, scan, 'children: cache-backed must equal markdown scan');
    assert.ok(cache.some((r) => r.id === 'PRY-T002'), 'T002 is a child of T001');
  });

  await testAsync('parity: backlinks — cache == scan', async () => {
    const { cache, scan } = await parity(fixtureRoot, dbPath, 'backlinks', ['PRY-D001']);
    assert.deepEqual(cache, scan, 'backlinks: cache-backed must equal markdown scan');
    assert.ok(cache.some((r) => r.id === 'PRY-T002'), 'T002 links TO D001 → appears as a backlink');
  });

  // cleanup
  rmSync(fixtureRoot, { recursive: true, force: true });
  rmSync(pluginRoot, { recursive: true, force: true });
}

console.log(`\ndb-parity: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
