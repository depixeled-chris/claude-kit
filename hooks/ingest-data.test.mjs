#!/usr/bin/env node
// Tests for hooks/ingest-data.mjs — the PostToolUse immediate-ingest hook (KIT-T026). Drives
// the hook the way the Claude Code harness does (spawnSync with a JSON payload on stdin) over
// a throwaway .ai store, and asserts: an edit under .ai syncs THAT item into the cache; a
// delete removes it; a non-store edit is a no-op; a malformed payload fails open. Skips the
// DB assertions when no SQLite engine is present (the cache, and this hook, are optional).

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { resolveEngine } from '../scripts/db-engine.mjs';
import { defaultDbPath } from '../scripts/hydrate-db.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'ingest-data.mjs');

// Isolate the hook's DB from the REAL cache (KIT-T035: no test ever writes the live
// .cache/workflow.db). defaultDbPath() honors CLAUDE_PLUGIN_ROOT, so point the spawned hook
// at a throwaway plugin root — its db lands in <tmp>/.cache/workflow.db, never the real one.
const PLUGIN_ROOT = mkdtempSync(join(tmpdir(), 'kit-ingest-root-'));

let pass = 0;
let fail = 0;
async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok    ${name}`);
  } catch (e) {
    fail++;
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

// Fire the hook exactly as the harness does: payload JSON on stdin, with the throwaway plugin
// root so it writes the temp db, not the real one.
function fire(filePath, raw) {
  return spawnSync(process.execPath, [HOOK], {
    input: raw !== undefined ? raw : JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: PLUGIN_ROOT },
  });
}

const engine = await resolveEngine();
const prevRoot = process.env.CLAUDE_PLUGIN_ROOT;
process.env.CLAUDE_PLUGIN_ROOT = PLUGIN_ROOT;
const dbPath = defaultDbPath(); // resolves under PLUGIN_ROOT now
if (prevRoot === undefined) delete process.env.CLAUDE_PLUGIN_ROOT;
else process.env.CLAUDE_PLUGIN_ROOT = prevRoot;
const rows = (sql, p = []) => { const d = engine(dbPath); const r = d.all(sql, p); d.close(); return r; };

// ---- fail-open + no-op guards (always run, no engine needed) ---------------
await test('malformed payload fails open (exit 0, no throw)', () => {
  const r = fire(undefined, 'not json at all');
  assert.equal(r.status, 0, 'a garbage payload must never wedge the tool call');
});

await test('empty payload is a no-op (exit 0)', () => {
  const r = fire(undefined, '{}');
  assert.equal(r.status, 0);
});

await test('an edit OUTSIDE any .ai store is a no-op (exit 0)', () => {
  const r = fire(join(tmpdir(), 'somewhere', 'README.md'));
  assert.equal(r.status, 0);
});

// ---- real ingest (skipped without an engine) ------------------------------
if (!engine) {
  console.log('  skip  (no SQLite engine — fallback-only environment)');
} else {
  // A throwaway managed project; the hook walks up from the edited path to find its root and
  // syncs THAT scope single-root into the isolated temp db (never the real cache).
  const proj = mkdtempSync(join(tmpdir(), 'kit-ingest-'));
  const ai = join(proj, '.ai');
  mkdirSync(join(ai, 'inbox'), { recursive: true });
  writeFileSync(join(ai, 'config.yml'), 'ids:\n  key: "ING"\n  pad: 3\n');
  const cap = join(ai, 'inbox', '2026-06-05-1200-flux-capacitor.md');

  await test('editing a store file ingests it into the cache immediately', () => {
    writeFileSync(cap, '(bug) flux capacitor overheats at 88mph\n');
    const r = fire(cap);
    assert.equal(r.status, 0);
    const got = rows("SELECT id, store, type FROM items WHERE id = 'ING-INBOX-2026-06-05-1200-flux-capacitor'");
    assert.equal(got.length, 1, 'the cap is now an indexed item');
    assert.equal(got[0].store, 'inbox');
    assert.equal(got[0].type, 'bug', 'leading (type) parsed');
    const fts = rows("SELECT id FROM items_fts WHERE items_fts MATCH 'capacitor'");
    assert.ok(fts.some((x) => x.id === 'ING-INBOX-2026-06-05-1200-flux-capacitor'), 'FTS-searchable right away');
  });

  await test('deleting a store file removes it from the cache on the next edit hook', () => {
    rmSync(cap);
    const r = fire(cap);
    assert.equal(r.status, 0);
    const got = rows("SELECT COUNT(*) c FROM items WHERE id = 'ING-INBOX-2026-06-05-1200-flux-capacitor'");
    assert.equal(got[0].c, 0, 'the deleted cap is gone from the cache');
  });

  rmSync(proj, { recursive: true, force: true });
}

rmSync(PLUGIN_ROOT, { recursive: true, force: true });
console.log(`\ningest-data: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
