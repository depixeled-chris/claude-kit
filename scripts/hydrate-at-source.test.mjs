#!/usr/bin/env node
// Guarantee test: every item mutation hydrates that item into the SQLite cache
// SYNCHRONOUSLY at the write site (KIT-T096). Proof method: open the DB DIRECTLY via
// resolveEngine() immediately after the mutation — no q.mjs call, no dbOpen self-heal —
// and assert the row is present. A negative control (bare writeFileSync, no writeItemFile)
// asserts the row is ABSENT, proving the test can distinguish hydrated-at-source from not.
// Skipped in full when no SQLite engine is present (the cache is optional).

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { resolveEngine } from './db-engine.mjs';
import { writeItemFile } from '../hooks/lib.mjs';
import { hydrate } from './hydrate-db.mjs';
import { scaffoldNew, setStatus, tick as tickFn } from './t.mjs';

const CAP = join(fileURLToPath(import.meta.url), '..', 'cap.mjs');
const T = join(fileURLToPath(import.meta.url), '..', 't.mjs');
const TRIAGE = join(fileURLToPath(import.meta.url), '..', 'triage.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ok    ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
async function testAsync(name, fn) {
  try { await fn(); pass++; console.log(`  ok    ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name} — ${e && e.message ? e.message : e}`); }
}

const MIN_CONFIG = `classifications:
  bug:     { routes_to: tickets, priority: high, blocking: never }
  feature: { routes_to: tickets, priority: medium, blocking: never }
statuses:
  flow: [todo, doing, review, done]
  human_only: []
  off_board: [superseded]
uat:
  default: none
history:
  archive_done_to: tickets/archive
ids:
  key: "TST"
  prefix: "TST-T"
  pad: 3
`;

// A throwaway adopted repo with its OWN isolated DB path — never touches the real cache.
function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-hydrate-src-'));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
  mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
  mkdirSync(join(root, '.ai', 'questions'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), MIN_CONFIG);
  // Minimal ticket template for triage --apply
  writeFileSync(join(root, '.ai', 'tickets', '_TEMPLATE.md'),
    `---\nid: TST-T000\ntitle: <short imperative title>\ntype: bug\nstatus: todo\npriority: medium\nlinks: []\ncreated: <YYYY-MM-DDThh:mm:ssZ>\nupdated: <YYYY-MM-DDThh:mm:ssZ>\n---\n\n## Description\n<what and why>\n\n## Notes\n`);
  return root;
}

// Isolated DB path under the throwaway repo (not the kit-root default).
function dbPath(root) {
  const p = join(root, '.cache', 'workflow.db');
  mkdirSync(join(root, '.cache'), { recursive: true });
  return p;
}

// Open the DB directly (bypassing q.mjs and its self-heal dbOpen). Returns the raw handle.
// Callers MUST call db.close() when done.
async function openDirect(db) {
  const open = await resolveEngine();
  if (!open) return null;
  return open(db);
}

// Seed the DB before a mutation so the "row present" result can only come from the mutation
// itself (not a prior global hydrate). Returns the seeded dbPath.
async function seedDb(root) {
  const db = dbPath(root);
  // Hydrate the current state (typically empty or pre-existing tickets).
  await hydrate({ root, dbPath: db });
  return db;
}

const engine = await resolveEngine();
if (!engine) {
  console.log('  skip  (no SQLite engine — cache is optional; hydrate-at-source tests need one)');
  console.log('\nhydrate-at-source: 0 passed, 0 failed (skipped — no engine)');
  process.exit(0);
}

// ---- NEGATIVE CONTROL -------------------------------------------------------
// Proves the test has teeth: a bare writeFileSync with NO writeItemFile → the row MUST be
// absent immediately after. If this control passes, the positive tests are meaningful.
console.log('\n[negative control] bare writeFileSync does NOT hydrate the item');
await testAsync('bare writeFileSync: row absent immediately after write (no hydrate)', async () => {
  const root = makeRepo();
  fixtures.push(root);
  const db = await seedDb(root);

  // Write a cap file directly — bypassing writeItemFile, which is what the pre-T096 bug was.
  const capFile = join(root, '.ai', 'inbox', `2026-01-01-0001-negative-ctrl.md`);
  writeFileSync(capFile, '(bug) negative control test\n');

  const handle = await openDirect(db);
  const rows = handle.all("SELECT id FROM items WHERE store='inbox'");
  handle.close();
  // The row must be ABSENT — no hydrate happened.
  const inboxIds = rows.map((r) => r.id);
  if (inboxIds.some((id) => id.includes('negative-ctrl'))) {
    throw new Error(`negative control FAILED: bare writeFileSync produced a DB row (id: ${inboxIds.join(', ')})`);
  }
  rmSync(root, { recursive: true, force: true });
});

// ---- cap.mjs ----------------------------------------------------------------
// Spawn the real CLI so the full entry-point path (Bash → node cap.mjs) is exercised.
console.log('\n[cap] cap.mjs writes to inbox/ and hydrates immediately');
await testAsync('cap: spawning cap creates the inbox item and it is in the DB directly after', async () => {
  const root = makeRepo();
  const db = await seedDb(root);

  execFileSync(process.execPath, [CAP, 'bug', 'login redirect loops after sso'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-kit-reg.json'), CLAUDE_PLUGIN_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Direct DB read — no q, no self-heal.
  const handle = await openDirect(db);
  const rows = handle.all("SELECT id FROM items WHERE store='inbox'");
  handle.close();
  if (!rows.length) throw new Error('cap: no inbox item in DB immediately after cap (hydrate-at-source gap)');
  const body = rows.map((r) => JSON.stringify(r)).join(', ');
  ok('cap: inbox item present in DB immediately (no Stop/self-heal)', rows.length >= 1, body);
  rmSync(root, { recursive: true, force: true });
});

// ---- t new ------------------------------------------------------------------
// Call t.mjs's exported scaffoldNew + writeItemFile path, then hydrate via refresh (t's normal flow).
// We spawn the real CLI so the `refresh()` wiring (which calls hydrate) runs end-to-end.
console.log('\n[t new] t.mjs scaffoldNew + refresh hydrates immediately');
await testAsync('t new: spawning t new creates the ticket and it is in the DB directly after', async () => {
  const root = makeRepo();
  const db = await seedDb(root);

  execFileSync(process.execPath, [T, 'new', 'bug', 'login redirect loops after sso'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-kit-reg.json'), CLAUDE_PLUGIN_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Direct DB read — no q, no self-heal.
  const handle = await openDirect(db);
  const rows = handle.all("SELECT id FROM items WHERE store='tickets' AND status='todo'");
  handle.close();
  if (!rows.length) throw new Error('t new: no ticket in DB immediately after t new');
  ok('t new: ticket present in DB immediately (no Stop/self-heal)', rows.length >= 1);
  rmSync(root, { recursive: true, force: true });
});

// ---- t status ---------------------------------------------------------------
console.log('\n[t status] t.mjs setStatus + refresh hydrates the changed row immediately');
await testAsync('t status: spawning t status updates the DB directly after', async () => {
  const root = makeRepo();
  // Seed a ticket first via t new.
  execFileSync(process.execPath, [T, 'new', 'bug', 'a ticket to advance'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-kit-reg.json'), CLAUDE_PLUGIN_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const db = await seedDb(root);

  // Now change status to doing.
  execFileSync(process.execPath, [T, 'status', 'TST-T001', 'doing'], {
    cwd: root, encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-kit-reg.json'), CLAUDE_PLUGIN_ROOT: root },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Direct DB read — no q, no self-heal.
  const handle = await openDirect(db);
  const rows = handle.all("SELECT id, status FROM items WHERE id='TST-T001'");
  handle.close();
  if (!rows.length) throw new Error('t status: TST-T001 not in DB immediately after t status');
  if (rows[0].status !== 'doing') throw new Error(`t status: status in DB is '${rows[0].status}', expected 'doing'`);
  ok('t status: updated status present in DB immediately (no Stop/self-heal)', rows[0].status === 'doing');
  rmSync(root, { recursive: true, force: true });
});

// ---- triage apply -----------------------------------------------------------
// triage/apply.mjs calls hydrate({dbPath, ifStale:true}) after the batch write — this
// satisfies the invariant for the triage entry-point (all items written then sync).
// Spawned in a child process (like cap/rem tests) to avoid module-cache pollution from the
// earlier tests in this process that also manipulate env vars and import shared modules.
console.log('\n[triage apply] triage --apply hydrates the new ticket immediately');
await testAsync('triage apply: new ticket from --apply is in the DB directly after', async () => {
  const TRIAGE_HELPER = join(fileURLToPath(import.meta.url), '..', 'hydrate-at-source-triage-helper.mjs');
  // Write a self-contained helper script that runs plan+apply in a fresh process with its
  // own env, then reads the DB directly and prints PASS or FAIL.
  writeFileSync(TRIAGE_HELPER, `#!/usr/bin/env node
// Spawned helper: isolated plan+apply triage test (KIT-T096 guarantee test).
// Writes PASS or FAIL\\n to stdout; details to stderr.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveEngine } from './db-engine.mjs';

const root = mkdtempSync(join(tmpdir(), 'kit-triage-src-'));
mkdirSync(join(root, '.ai', 'tickets', 'archive'), { recursive: true });
mkdirSync(join(root, '.ai', 'inbox'), { recursive: true });
mkdirSync(join(root, '.ai', 'questions'), { recursive: true });
mkdirSync(join(root, '.cache'), { recursive: true });
writeFileSync(join(root, '.ai', 'config.yml'),
  'classifications:\\n  bug: { routes_to: tickets, priority: high, blocking: never }\\nstatuses:\\n  flow: [todo, doing, review, done]\\nids:\\n  key: TST\\n  prefix: TST-T\\n  pad: 3\\n');
writeFileSync(join(root, '.ai', 'tickets', '_TEMPLATE.md'),
  '---\\nid: TST-T000\\ntitle: <short imperative title>\\ntype: bug\\nstatus: todo\\npriority: medium\\nlinks: []\\ncreated: <YYYY-MM-DDThh:mm:ssZ>\\nupdated: <YYYY-MM-DDThh:mm:ssZ>\\n---\\n\\n## Description\\n<what and why>\\n\\n## Notes\\n');
const regPath = join(root, 'registry.json');
writeFileSync(regPath, JSON.stringify({ projects: { test: root } }));
process.env.CLAUDE_KIT_REGISTRY = regPath;
process.env.CLAUDE_PLUGIN_ROOT = root;
writeFileSync(join(root, '.ai', 'inbox', '2026-01-01-0001-login-loops.md'), '(bug) login redirect loops after sso\\n');
const db = join(root, '.cache', 'workflow.db');
try {
  const { plan } = await import('./triage/plan.mjs');
  const planOut = await plan({ scopeFilter: 'TST', json: true, dbPath: db });
  const capItem = (planOut.items || []).find((i) => i.scope === 'TST' && i.capId);
  if (!capItem) { process.stderr.write('no inbox cap in plan\\n'); process.stdout.write('FAIL\\n'); process.exit(0); }
  const decisionsPath = join(root, 'dec.json');
  writeFileSync(decisionsPath, JSON.stringify([{ capId: capItem.capId, classification: 'bug', action: 'create' }]));
  const { apply } = await import('./triage/apply.mjs');
  await apply({ decisionsPath, json: false, dbPath: db });
  // Direct DB read — no q, no self-heal.
  const open = await resolveEngine();
  if (!open) { process.stdout.write('SKIP\\n'); process.exit(0); }
  const handle = open(db);
  const rows = handle.all("SELECT id FROM items WHERE store='tickets'");
  handle.close();
  process.stdout.write(rows.length ? 'PASS\\n' : 'FAIL\\n');
} catch(e) {
  process.stderr.write('triage helper error: ' + e.message + '\\n');
  process.stdout.write('FAIL\\n');
} finally {
  try { rmSync(root, { recursive: true, force: true }); } catch {}
}
`);

  let out;
  try {
    out = execFileSync(process.execPath, [TRIAGE_HELPER], {
      cwd: join(fileURLToPath(import.meta.url), '..'),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    try { writeFileSync(TRIAGE_HELPER, ''); } catch {}  // blank the helper (don't leave it)
    try { rmSync(TRIAGE_HELPER); } catch {}
  }

  const result = out.trim().split('\n').find((l) => l === 'PASS' || l === 'FAIL' || l === 'SKIP');
  if (result === 'SKIP') {
    console.log('  skip  triage apply: no SQLite engine in helper process');
    return;
  }
  if (result !== 'PASS') throw new Error('triage apply: ticket not in DB immediately after --apply (helper returned FAIL)');
  ok('triage apply: triaged ticket present in DB immediately (no Stop/self-heal)', true);
});

// ---- cleanup ----------------------------------------------------------------
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\nhydrate-at-source: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
