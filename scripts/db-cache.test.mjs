#!/usr/bin/env node
// Tests for the KIT-T004 SQLite query cache: parse → hydrate → query, idempotency, and
// the markdown-scan fallback. Builds a throwaway .ai store in a temp dir so the test is
// hermetic (no dependency on the live claude-kit stores). Skips the SQLite-backed half if
// no engine is present — the cache is optional, and so is testing it.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { collectItems, readCount, resetReadCount } from './db-parse.mjs';
import { hydrate } from './hydrate-db.mjs';
import { resolveEngine } from './db-engine.mjs';
import { query } from './q.mjs';
import { nextId } from './id-utils.mjs';
import { reconcileSupersede, autoDedupTickets } from './reconcile-supersede.mjs';

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

// ---- auto-dedup of unambiguous TICKET duplicates (KIT-T025, locked policy C) ---------------
// Strict bar: same scope + IDENTICAL normalized title + detector-confirmed. Survivor = lower
// id; loser auto-superseded via the KIT-T024 reconcile mechanism. Decisions/notes stay
// suggest-only (never auto-resolved). Idempotent. Engine-agnostic (query() fails open to scan).
async function autoDedupTests() {
  const droot = mkdtempSync(join(tmpdir(), 'kit-dedup-'));
  const dai = join(droot, '.ai');
  mkdirSync(join(dai, 'tickets'), { recursive: true });
  mkdirSync(join(dai, 'decisions'), { recursive: true });
  writeFileSync(join(dai, 'config.yml'), 'ids:\n  key: "DUP"\n  pad: 3\n');
  const field = (text, key) => (text.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm')) || [, ''])[1].trim();

  // (a) Two same-title tickets (title differs only in case/punctuation) → unambiguous dup.
  const lowPath = join(dai, 'tickets', 'DUP-T001-a.md');
  const highPath = join(dai, 'tickets', 'DUP-T005-b.md');
  writeFileSync(lowPath,
    `---\nid: DUP-T001\ntitle: Add streaming world chunks\ntype: feature\nstatus: todo\npriority: high\n---\n## Description\nstream chunks on demand\n`);
  writeFileSync(highPath,
    `---\nid: DUP-T005\ntitle: add streaming world chunks!\ntype: feature\nstatus: todo\npriority: medium\n---\n## Description\nstream chunks on demand\n`);
  // (b) Merely-similar (DIFFERENT title, overlapping terms) → must NOT auto-resolve.
  writeFileSync(join(dai, 'tickets', 'DUP-T002-c.md'),
    `---\nid: DUP-T002\ntitle: Stream world audio chunks lazily\ntype: feature\nstatus: todo\npriority: low\n---\n## Description\nstream audio\n`);
  // (c) Two identical-title DECISIONS → suggest-only store, must NOT auto-resolve.
  writeFileSync(join(dai, 'decisions', 'DUP-D001.md'),
    `---\nid: DUP-D001\ntitle: Use seeded RNG everywhere\ndate: 2026-06-05\n---\n**Decision:** seeded RNG\n`);
  writeFileSync(join(dai, 'decisions', 'DUP-D002.md'),
    `---\nid: DUP-D002\ntitle: use seeded rng everywhere\ndate: 2026-06-05\n---\n**Decision:** seeded RNG, refined\n`);

  // First pass: auto-dedup writes the supersedes edge (survivor = lower id DUP-T001).
  const first = await autoDedupTickets(droot);
  test('auto-dedup resolves exactly one unambiguous ticket pair', () =>
    assert.equal(first.changed.length, 1, `expected 1 change, got: ${first.changed.join('; ')}`));
  test('auto-dedup survivor is the LOWER id, superseding the higher', () =>
    assert.equal(field(readFileSync(lowPath, 'utf8'), 'supersedes'), 'DUP-T005'));

  // Reconcile then flips the loser + writes the reciprocal pointer (KIT-T024 mechanism).
  reconcileSupersede(droot);
  const highAfter = readFileSync(highPath, 'utf8');
  test('auto-dedup loser is flipped to status: superseded (via reconcile)', () =>
    assert.equal(field(highAfter, 'status'), 'superseded'));
  test('auto-dedup writes the reciprocal superseded_by on the loser', () =>
    assert.equal(field(highAfter, 'superseded_by'), 'DUP-T001'));

  // (a) loser drops out of the open/drain set; survivor + the merely-similar one stay open.
  await testAsync('auto-deduped loser is dropped from q.mjs open; survivor + similar stay', async () => {
    const { rows } = await query('open', [], { root: droot, noDb: true });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes('DUP-T001'), 'survivor stays open');
    assert.ok(!ids.includes('DUP-T005'), 'auto-superseded loser drops out');
    // (b) merely-similar ticket (different title) is NOT auto-resolved — still open.
    assert.ok(ids.includes('DUP-T002'), 'a merely-similar (different-title) ticket is NOT auto-resolved');
  });

  // (c) decisions with identical titles are untouched (suggest-only store).
  test('identical-title DECISIONS are NOT auto-resolved (suggest-only)', () => {
    const d1 = readFileSync(join(dai, 'decisions', 'DUP-D001.md'), 'utf8');
    const d2 = readFileSync(join(dai, 'decisions', 'DUP-D002.md'), 'utf8');
    assert.equal(field(d1, 'supersedes'), '', 'decision survivor gets no supersedes edge');
    assert.equal(field(d2, 'superseded_by'), '', 'decision dup is not retired');
  });

  // (d) idempotency: re-running both passes changes nothing and rewrites no bytes.
  const lowBytes = readFileSync(lowPath, 'utf8');
  const highBytes = readFileSync(highPath, 'utf8');
  const second = await autoDedupTickets(droot);
  reconcileSupersede(droot);
  test('second auto-dedup run is a no-op (idempotent)', () =>
    assert.equal(second.changed.length, 0, `expected 0 changes, got: ${second.changed.join('; ')}`));
  test('idempotent auto-dedup + reconcile rewrites no file content', () => {
    assert.equal(readFileSync(lowPath, 'utf8'), lowBytes);
    assert.equal(readFileSync(highPath, 'utf8'), highBytes);
  });

  rmSync(droot, { recursive: true, force: true });
}
await autoDedupTests();

// ---- cross-store dedup (KIT-T025), scan path (always runs, no engine needed) ---------------
// `similar --store <s>` must confine candidates to that store so a proposed item dedupes against
// the store it's being created into, not just tickets. Forced down the markdown-scan path
// (noDb:true) so this runs in a fallback-only environment too.
await testAsync('similar --store decisions surfaces the decision, excludes tickets (scan)', async () => {
  const { rows } = await query('similar', ['--store', 'decisions', 'widgets'], { root, noDb: true });
  const ids = rows.map((r) => r.id);
  assert.ok(ids.includes('TST-D001'), 'the matching decision is a candidate in its own store');
  assert.ok(ids.every((id) => id.startsWith('TST-D')), 'only decisions are candidates (tickets excluded)');
});
await testAsync('similar defaults to tickets when no --store (scan, KIT-T024 back-compat)', async () => {
  const { rows } = await query('similar', ['widget', 'engine'], { root, noDb: true });
  assert.ok(rows.every((r) => r.id.startsWith('TST-T')), 'default store stays tickets');
});

// ---- file-scoped governance + structural drift (KIT-T049), scan path (always runs) ---------
// The INVERSE of `q trail`: given file path(s), which OPEN tickets/in-force decisions GOVERN
// them; plus `q drift` flagging a decided-but-unbuilt structural target. Hermetic fixture that
// reproduces the motivating HOD failure: a ticket `files:`-scoped to src/sim that sits `todo`
// while src/sim is worked, a standing decision globbing src/world/*, and a "retire X as truth /
// keep frozen as the example" reorg with NO frozen/legacy area on disk. Forced down the
// markdown-scan path (noDb) so it proves the fail-open path with no engine.
async function governanceTests() {
  const groot = mkdtempSync(join(tmpdir(), 'kit-gov-'));
  const gai = join(groot, '.ai');
  mkdirSync(join(gai, 'tickets'), { recursive: true });
  mkdirSync(join(gai, 'decisions'), { recursive: true });
  writeFileSync(join(gai, 'config.yml'), 'ids:\n  key: "GOV"\n  pad: 3\n');
  // A real (partial) repo tree the drift check probes against: src/sim + src/world exist; NO
  // legacy/frozen separation dir exists (the structural target the reorg ticket never built).
  mkdirSync(join(groot, 'src', 'sim'), { recursive: true });
  mkdirSync(join(groot, 'src', 'world'), { recursive: true });
  writeFileSync(join(groot, 'src', 'main.ts'), '// host\n');

  // T001: the motivating ticket — OPEN (todo), files-scoped to src/sim + src/main.ts, and its
  // body declares the retire-as-truth / frozen-example reorg (drift's unrealized-separation).
  writeFileSync(join(gai, 'tickets', 'GOV-T001-retire.md'),
    `---\nid: GOV-T001\ntitle: Host = viewer; retire TS-as-truth\ntype: feature\nstatus: todo\npriority: medium\nfiles: [src/sim, src/main.ts]\n---\n## Description\nRetire the TS sim as the product's truth; kept frozen as the gta7 example.\n`);
  // T002: a CLOSED (done) ticket on src/sim — must NOT govern (its work is finished).
  writeFileSync(join(gai, 'tickets', 'GOV-T002-done.md'),
    `---\nid: GOV-T002\ntitle: old sim cleanup\ntype: chore\nstatus: done\npriority: low\nfiles: [src/sim]\n---\n## Description\nfinished\n`);
  // T003: a template-style empty files list WITH an inline comment — must parse to NO targets
  // (the comment is stripped), so it never produces a junk governing/drift entry.
  writeFileSync(join(gai, 'tickets', 'GOV-T003-empty.md'),
    `---\nid: GOV-T003\ntitle: unscoped idea\ntype: feature\nstatus: todo\npriority: low\nfiles: []              # repo-root-relative paths this ticket touches\n---\n## Description\nno files yet\n`);
  // T004: declares a DECLARED target that's absent on disk (src/legacy/*) — drift must flag it.
  writeFileSync(join(gai, 'tickets', 'GOV-T004-move.md'),
    `---\nid: GOV-T004\ntitle: move things to legacy\ntype: chore\nstatus: todo\npriority: low\nfiles: [src/legacy/Old.ts]\n---\n## Description\nrelocate\n`);
  // D001: a standing decision globbing src/world/* — governs any edit under src/world, and has
  // NO flow status (proves decisions are in-force without todo/doing/review).
  writeFileSync(join(gai, 'decisions', 'GOV-D001.md'),
    `---\nid: GOV-D001\ntitle: world is data-model-first\nstanding: true\nscope: world-gen\npaths: src/world/*, rust/*\ndate: 2026-06-06\n---\n**Decision:** plan the world like an urban planner.\n`);
  // D002: a REJECTED decision — must never govern.
  writeFileSync(join(gai, 'decisions', 'GOV-D002.md'),
    `---\nid: GOV-D002\ntitle: rejected world idea\nstatus: rejected\npaths: src/world/*\ndate: 2026-06-06\n---\n**Decision:** no.\n`);

  // (1) a file path → its governing OPEN items, DECISIONS first.
  await testAsync('governing: a src/sim edit surfaces the OPEN ticket scoped to it', async () => {
    const { rows } = await query('governing', ['src/sim/WasmSim.ts'], { root: groot, noDb: true });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes('GOV-T001'), 'the todo ticket files-scoped to src/sim governs the edit');
    assert.ok(!ids.includes('GOV-T002'), 'a DONE ticket no longer governs (its work is finished)');
    assert.equal(rows.find((r) => r.id === 'GOV-T001').matched, 'src/sim', 'reports WHICH pattern matched');
  });

  // (2) glob path matching: a decision `paths: src/world/*` governs src/world/City.ts.
  await testAsync('governing: a decision glob (src/world/*) governs an edit under it', async () => {
    const { rows } = await query('governing', ['src/world/City.ts'], { root: groot, noDb: true });
    const ids = rows.map((r) => r.id);
    assert.ok(ids.includes('GOV-D001'), 'the standing decision globbing src/world/* governs the edit');
    assert.ok(!ids.includes('GOV-D002'), 'a REJECTED decision never governs');
  });

  // decisions sort FIRST (the context to read before acting), tickets after.
  await testAsync('governing: decisions are surfaced before tickets', async () => {
    const { rows } = await query('governing', ['src/world/City.ts', 'src/main.ts'], { root: groot, noDb: true });
    const firstTicket = rows.findIndex((r) => r.store === 'tickets');
    const lastDecision = rows.map((r) => r.store).lastIndexOf('decisions');
    if (firstTicket >= 0 && lastDecision >= 0) {
      assert.ok(lastDecision < firstTicket, 'every decision sorts before every ticket');
    }
  });

  // an unrelated path governs nothing.
  await testAsync('governing: an ungoverned path returns no items', async () => {
    const { rows } = await query('governing', ['docs/readme.md'], { root: groot, noDb: true });
    assert.deepEqual(rows, [], 'no ticket/decision claims docs/readme.md');
  });

  // (3) drift: the never-done legacy/frozen separation lights up; the absent declared target too.
  await testAsync('drift: flags the unrealized retire-as-truth separation + an absent declared target', async () => {
    const { rows } = await query('drift', [], { root: groot, noDb: true });
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    assert.ok(byId['GOV-T001'], 'the retire-TS-as-truth ticket is flagged (no legacy/frozen area exists)');
    assert.match(byId['GOV-T001'].reason, /unrealized-separation/, 'reason names the unrealized separation');
    assert.match(byId['GOV-T001'].absent, /legacy|frozen/, 'the missing separation dir(s) are reported');
    assert.ok(byId['GOV-T004'], 'a ticket naming an absent declared path (src/legacy/Old.ts) is flagged');
    assert.match(byId['GOV-T004'].reason, /declared-target-absent/, 'reason names the absent declared target');
  });

  await testAsync('drift: does NOT flag items whose declared targets all exist, nor empty/commented files', async () => {
    const { rows } = await query('drift', [], { root: groot, noDb: true });
    const ids = rows.map((r) => r.id);
    assert.ok(!ids.includes('GOV-D001'), 'a decision globbing src/world/* + rust/* is not drift (globs are governance scopes, not concrete must-exist targets)');
    assert.ok(!ids.includes('GOV-T002'), 'a DONE ticket is never drift-checked');
    assert.ok(!ids.includes('GOV-T003'), 'an empty `files: [] # comment` ticket yields no junk target (comment stripped)');
  });

  // (4) fail-open: governing/drift run with NO cache (noDb) — already exercised above, assert
  // the path is honest about not using SQLite.
  await testAsync('governing/drift are scan-only + fail-open (cached:false, never throw)', async () => {
    const g = await query('governing', ['src/sim/X.ts'], { root: groot, noDb: true });
    const d = await query('drift', [], { root: groot, noDb: true });
    assert.equal(g.cached, false, 'governing does not depend on the SQLite cache');
    assert.equal(d.cached, false, 'drift does not depend on the SQLite cache');
  });

  // db-parse exposes decision scope/paths on the row model (the parse the verbs reuse).
  test('db-parse exposes decision scope + paths (KIT-T049)', () => {
    const gitems = collectItems(groot);
    const d1 = gitems.find((i) => i.id === 'GOV-D001');
    assert.equal(d1.govScope, 'world-gen', 'governance scope parsed (govScope, not the id-prefix scope)');
    assert.equal(d1.scope, 'GOV', 'the row scope stays the id prefix, not the governance scope');
    assert.deepEqual(d1.paths, ['src/world/*', 'rust/*'], 'paths parsed as a comma list');
    const t3 = gitems.find((i) => i.id === 'GOV-T003');
    assert.deepEqual(t3.files, [], 'an empty files list with a trailing # comment parses to []');
  });

  rmSync(groot, { recursive: true, force: true });
}
await governanceTests();

// ---- id-LESS store coverage (KIT-T026/KIT-D024), pure-parse path (always runs) -------------
// inbox caps + questions are tracked items the cache used to be blind to. A frontmatter-less
// inbox cap (`(type) text`) and a questions file must BOTH parse into items with a STABLE
// synthetic id, store, type, and an FTS body — without an engine.
function makeCoverageFixture() {
  const croot = mkdtempSync(join(tmpdir(), 'kit-cov-'));
  const cai = join(croot, '.ai');
  mkdirSync(join(cai, 'tickets'), { recursive: true });
  mkdirSync(join(cai, 'inbox'), { recursive: true });
  mkdirSync(join(cai, 'questions'), { recursive: true });
  writeFileSync(join(cai, 'config.yml'), 'ids:\n  key: "COV"\n  pad: 3\n');
  writeFileSync(join(cai, 'tickets', 'COV-T001-real.md'),
    `---\nid: COV-T001\ntitle: a real ticket\ntype: feature\nstatus: todo\npriority: high\n---\nbody about turbines\n`);
  // an inbox cap exactly as cap.mjs writes it: a frontmatter-less `(type) text` one-liner.
  writeFileSync(join(cai, 'inbox', '2026-06-05-1200-login-loops.md'), '(bug) login redirect loops after sso\n');
  // a questions file (also frontmatter-less here) — must still index + FTS.
  writeFileSync(join(cai, 'questions', '2026-06-05-which-engine.md'), 'which sqlite engine should the cache prefer?\n');
  return { croot, cai };
}

const cov = makeCoverageFixture();
const covItems = collectItems(cov.croot);
const covById = (id) => covItems.find((i) => i.id === id);
test('inbox cap is indexed with a stable synthetic id + store', () => {
  const it = covById('COV-INBOX-2026-06-05-1200-login-loops');
  assert.ok(it, 'the inbox cap is collected as an item');
  assert.equal(it.store, 'inbox');
});
test('inbox cap leading (type) becomes the item type', () =>
  assert.equal(covById('COV-INBOX-2026-06-05-1200-login-loops').type, 'bug'));
test('inbox cap captures the whole line as FTS body', () =>
  assert.match(covById('COV-INBOX-2026-06-05-1200-login-loops').body, /login redirect loops/));
test('questions file is indexed with a stable synthetic id + store', () => {
  const it = covById('COV-QUESTIONS-2026-06-05-which-engine');
  assert.ok(it, 'the questions file is collected as an item');
  assert.equal(it.store, 'questions');
});
test('synthetic ids carry no num (never perturb next-id)', () => {
  assert.equal(covById('COV-INBOX-2026-06-05-1200-login-loops').num, null);
  assert.equal(covById('COV-QUESTIONS-2026-06-05-which-engine').num, null);
});

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

  // Cross-store dedup (KIT-T025): `--store <s>` confines candidates to that store, cache==scan.
  await testAsync('parity: similar --store decisions confines to decisions (cache == scan)', async () => {
    const { cache, scan } = await parity('similar', ['--store', 'decisions', 'widgets']);
    assert.deepEqual(cache, scan, 'cross-store similar must equal the markdown scan');
    const ids = cache.map((r) => r.id);
    assert.ok(ids.includes('TST-D001'), 'the matching decision is surfaced in its own store');
    assert.ok(ids.every((id) => id.startsWith('TST-D')), 'only decisions are candidates (tickets excluded)');
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

  // ---- incremental SYNC (KIT-T026/KIT-D024) — efficiency + correctness -----------------
  // The cache syncs the dirty set only: NO drop-and-rebuild. These assert (1) inbox+questions
  // are FTS-searchable post-sync, (2) editing ONE file re-parses exactly that file and leaves
  // OTHER items' rows untouched, (3) a no-op sync reads zero bodies + writes zero rows,
  // (4) deleting a file removes exactly its rows + manifest entry, (5) rm db + sync reproduces
  // the same item set via the sync path.
  const cdb = join(cov.croot, '.cache', 'workflow.db');
  const open = engine;
  const rows = (sql, p = []) => { const d = open(cdb); const r = d.all(sql, p); d.close(); return r; };
  const oneCol = (sql, p = []) => rows(sql, p).map((r) => Object.values(r)[0]);

  await testAsync('sync: initial populate indexes inbox + questions, FTS-searchable', async () => {
    const r = await hydrate({ root: cov.croot, dbPath: cdb });
    assert.ok(r.ok, 'sync succeeds');
    const stores = Object.fromEntries(rows('SELECT store, COUNT(*) c FROM items GROUP BY store').map((x) => [x.store, x.c]));
    assert.equal(stores.inbox, 1, 'inbox indexed');
    assert.equal(stores.questions, 1, 'questions indexed');
    // FTS over the inbox cap body + the questions body.
    assert.deepEqual(oneCol("SELECT id FROM items_fts WHERE items_fts MATCH 'login'"),
      ['COV-INBOX-2026-06-05-1200-login-loops'], 'inbox cap is FTS-searchable');
    assert.deepEqual(oneCol("SELECT id FROM items_fts WHERE items_fts MATCH 'sqlite'"),
      ['COV-QUESTIONS-2026-06-05-which-engine'], 'questions file is FTS-searchable');
  });

  await testAsync('sync: the per-file delete is an index seek (idx_items_file exists, used)', async () => {
    const idx = oneCol("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='items'");
    assert.ok(idx.includes('idx_items_file'), 'WHERE file=? AND scope=? must be indexed (KIT-T026 efficiency)');
    assert.ok(idx.includes('idx_items_type'), 'WHERE type=? must be indexed');
    assert.ok(idx.includes('idx_items_scope_store_num'), 'next-id MAX(num) per (scope,store) must be indexed');
    // the query planner actually USES the index for the sync's delete probe (not a full scan).
    const plan = rows("EXPLAIN QUERY PLAN SELECT id, file FROM items WHERE file = ? AND scope = ?",
      ['questions/2026-06-05-which-engine.md', 'COV']).map((r) => r.detail).join(' ');
    assert.match(plan, /idx_items_file/, `per-file delete uses idx_items_file, not a scan (plan: ${plan})`);
  });

  await testAsync('sync: a no-op sync reads ZERO bodies and writes ZERO rows', async () => {
    const before = rows('SELECT id, title, status FROM items ORDER BY id');
    resetReadCount();
    const r = await hydrate({ root: cov.croot, dbPath: cdb });
    assert.equal(readCount(), 0, 'no store file body is read when nothing changed');
    assert.equal(r.reparsed, 0, 'no file re-parsed');
    assert.equal(r.deleted, 0, 'no file deleted');
    assert.deepEqual(rows('SELECT id, title, status FROM items ORDER BY id'), before, 'rows unchanged');
  });

  await testAsync('sync: editing ONE file re-parses exactly that file; OTHER rows untouched', async () => {
    // Identity sentinel: stamp a row on the UNTOUCHED ticket, prove the sync never rewrites it.
    { const d = open(cdb); d.run("UPDATE items SET title='SENTINEL' WHERE id='COV-T001'"); d.close(); }
    const qPath = join(cov.cai, 'questions', '2026-06-05-which-engine.md');
    // mtime must move; write a different size too so the stat-diff fires regardless of clock.
    writeFileSync(qPath, 'which sqlite engine should the cache prefer for hydration speed?\n');
    resetReadCount();
    const r = await hydrate({ root: cov.croot, dbPath: cdb });
    assert.equal(r.reparsed, 1, 'exactly one file re-parsed');
    assert.equal(readCount(), 1, 'exactly one body read (only the dirty file)');
    assert.equal(rows("SELECT title FROM items WHERE id='COV-T001'")[0].title, 'SENTINEL',
      'the untouched ticket row was NOT rewritten by the sync');
    assert.deepEqual(oneCol("SELECT id FROM items_fts WHERE items_fts MATCH 'hydration'"),
      ['COV-QUESTIONS-2026-06-05-which-engine'], 'the edited file re-indexed with new content');
  });

  await testAsync('sync: deleting a file removes exactly its rows + manifest entry', async () => {
    const qid = 'COV-QUESTIONS-2026-06-05-which-engine';
    assert.equal(rows('SELECT COUNT(*) c FROM items WHERE id=?', [qid])[0].c, 1, 'present before delete');
    rmSync(join(cov.cai, 'questions', '2026-06-05-which-engine.md'));
    const r = await hydrate({ root: cov.croot, dbPath: cdb });
    assert.equal(r.deleted, 1, 'exactly one file detected as deleted');
    assert.equal(rows('SELECT COUNT(*) c FROM items WHERE id=?', [qid])[0].c, 0, 'item rows gone');
    assert.equal(rows('SELECT COUNT(*) c FROM items_fts WHERE id=?', [qid])[0].c, 0, 'fts rows gone');
    assert.equal(rows('SELECT COUNT(*) c FROM source_files WHERE relpath=?',
      ['questions/2026-06-05-which-engine.md'])[0].c, 0, 'manifest entry gone');
    // the OTHER items survive the delete.
    assert.equal(rows("SELECT COUNT(*) c FROM items WHERE id='COV-T001'")[0].c, 1, 'sibling ticket survives');
  });

  await testAsync('sync: rm db + sync reproduces the same item set (full-populate via sync)', async () => {
    const restore = (sql) => oneCol(sql).join(',');
    const beforeIds = restore('SELECT id FROM items ORDER BY id');
    rmSync(cdb, { force: true });
    for (const ext of ['-wal', '-shm']) rmSync(cdb + ext, { force: true });
    const r = await hydrate({ root: cov.croot, dbPath: cdb });
    assert.ok(r.fresh, 'a removed db is rebuilt fresh by the sync path');
    assert.equal(restore('SELECT id FROM items ORDER BY id'), beforeIds,
      'rm db + sync reproduces the exact item set (no drop-and-rebuild needed)');
  });
}

rmSync(cov.croot, { recursive: true, force: true });
rmSync(root, { recursive: true, force: true });

console.log(`\ndb-cache: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
