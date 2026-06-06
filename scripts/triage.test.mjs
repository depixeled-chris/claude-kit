// triage.test.mjs — isolated tests for the programmatic triage script (KIT-T027). Every run gets a
// throwaway .ai fixture (a fresh TST scope), a throwaway registry (CLAUDE_KIT_REGISTRY), and a
// throwaway plugin root (CLAUDE_PLUGIN_ROOT → temp .cache), so the test NEVER writes the real
// cache or stores (KIT-T035). Assertions cover: --plan groups by scope, marks a (bug) cap
// deterministic with the config route, flags an untyped cap needsClassification, surfaces a dedup
// candidate, and opens the DB exactly once; --apply creates a ticket from a real next-id, folds on
// a fold action, moves the cap to triaged/, and lands the new item in the cache after the sync.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CONFIG_YML = `classifications:
  bug:        { routes_to: tickets,  priority: high,   blocking: never }
  feature:    { routes_to: backlog,  priority: medium, blocking: never }
  question:   { routes_to: questions, blocking: never }
statuses:
  flow: [todo, doing, review, done]
drain:
  order: [bug, feature]
ids:
  key: "TST"
  prefix: "TST-T"
  pad: 3
`;

const TICKET_TEMPLATE = `---
id: TST-T000
title: <short imperative title>
type: bug
status: todo
priority: medium
links: []
created: <YYYY-MM-DDThh:mm:ssZ>
updated: <YYYY-MM-DDThh:mm:ssZ>
---

## Description
<what and why>

## Notes
`;

let dir; // temp project root holding .ai
let aiDir;
let dbPath;

function cap(name, body) {
  writeFileSync(join(aiDir, 'inbox', name), body);
}

before(() => {
  dir = mkdtempSync(join(tmpdir(), 'triage-test-'));
  aiDir = join(dir, '.ai');
  for (const s of ['inbox', 'tickets', 'questions', 'notes', 'decisions']) mkdirSync(join(aiDir, s), { recursive: true });
  writeFileSync(join(aiDir, 'config.yml'), CONFIG_YML);
  writeFileSync(join(aiDir, 'tickets', '_TEMPLATE.md'), TICKET_TEMPLATE);

  // An existing ticket the dedup probe should surface for a same-topic cap.
  writeFileSync(join(aiDir, 'tickets', 'TST-T001-headlight-flicker.md'),
    `---\nid: TST-T001\ntype: bug\nstatus: todo\npriority: high\ntitle: headlight flicker at dusk\nlinks: []\n---\n\n## Description\nheadlight flicker at dusk on the player car\n`);

  cap('2026-06-01-0900-headlight-bug.md', '(bug) headlight flicker regression at dusk on player car\n');
  cap('2026-06-01-0901-some-idea.md', 'we should let the radio remember the last station across sessions\n');

  // Isolation: a registry pointing ONLY at this fixture, and a plugin root for a throwaway cache.
  process.env.CLAUDE_KIT_REGISTRY = join(dir, 'registry.json');
  writeFileSync(process.env.CLAUDE_KIT_REGISTRY, JSON.stringify({ projects: { test: dir } }));
  process.env.CLAUDE_PLUGIN_ROOT = dir;
  dbPath = join(dir, '.cache', 'workflow.db');
});

after(() => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

// Only this fixture's scope — the real KIT_ROOT .ai is always unioned into a cross-scope
// hydrate, so the test asserts on its own TST items, never the live ones.
const tst = (items) => items.filter((i) => i.scope === 'TST');

test('--plan groups inbox by scope, marks (bug) deterministic, flags untyped, surfaces a dedup candidate, opens DB once', async () => {
  const { plan } = await import('./triage/plan.mjs');
  const out = await plan({ scopeFilter: 'TST', json: true, dbPath });

  assert.equal(out.dbHandleOpens, 1, 'plan must run every query on ONE held-open handle');
  assert.deepEqual(out.scopes, ['TST'], 'scope filter confines the plan to the fixture scope');

  const items = tst(out.items);
  assert.equal(items.length, 2);

  const bug = items.find((i) => i.type === 'bug');
  assert.ok(bug, 'the (bug) cap is recognized by its explicit type');
  assert.equal(bug.needsClassification, false, 'an explicit configured type is deterministic');
  assert.equal(bug.route, 'tickets', 'bug routes to tickets per config');
  assert.equal(bug.priority, 'high', 'bug carries the config priority');
  assert.ok(bug.dedupCandidates.some((c) => c.id === 'TST-T001'), 'the same-topic ticket is a dedup candidate');

  const idea = items.find((i) => i.type === null);
  assert.ok(idea, 'the untyped cap has no resolved type');
  assert.equal(idea.needsClassification, true, 'an untyped cap needs LLM classification');
  assert.deepEqual(
    idea.allowedClassifications.sort(),
    ['bug', 'feature', 'question'],
    'the LLM is handed the scope’s allowed classifications',
  );
});

test('--apply creates a ticket from a real next-id, folds onto a target, moves caps to triaged/, and the item is cached after sync', async () => {
  const { apply } = await import('./triage/apply.mjs');

  const capId = (stem) => `TST-INBOX-${stem}`;
  const decisions = [
    { capId: capId('2026-06-01-0901-some-idea'), classification: 'feature', action: 'create' },
    { capId: capId('2026-06-01-0900-headlight-bug'), classification: 'bug', action: 'fold', target: 'TST-T001' },
  ];
  const decisionsPath = join(dir, 'decisions.json');
  writeFileSync(decisionsPath, JSON.stringify(decisions));

  const result = await apply({ decisionsPath, json: true, dbPath });

  // create → a fresh ticket at the next id (TST-T002, since TST-T001 exists), from the template.
  const created = result.applied.find((r) => r.action === 'create');
  assert.ok(created, 'the create decision produced a receipt');
  assert.match(created.dest, /^tickets\/TST-T002-/, 'next-id allocated TST-T002 (never hand-picked)');
  const ticketFile = readdirSync(join(aiDir, 'tickets')).find((f) => f.startsWith('TST-T002'));
  assert.ok(ticketFile, 'the new ticket file exists');
  const ticket = readFileSync(join(aiDir, 'tickets', ticketFile), 'utf8');
  assert.match(ticket, /id: TST-T002/);
  assert.match(ticket, /type: feature/);
  assert.match(ticket, /status: todo/, 'opens in the first flow status');
  assert.match(ticket, /remember the last station/, 'the cap text became the ticket body');

  // fold → a dated note appended to the target ticket.
  const folded = result.applied.find((r) => r.action === 'fold');
  assert.equal(folded.dest, 'tickets/TST-T001-headlight-flicker.md');
  const target = readFileSync(join(aiDir, 'tickets', 'TST-T001-headlight-flicker.md'), 'utf8');
  assert.match(target, /folded from triage/, 'the fold appended a note to the target');

  // caps moved (never deleted) to inbox/triaged/.
  assert.ok(existsSync(join(aiDir, 'inbox', 'triaged')), 'triaged dir was created');
  assert.equal(readdirSync(join(aiDir, 'inbox')).filter((f) => f.endsWith('.md')).length, 0, 'no caps left loose in inbox');
  assert.equal(readdirSync(join(aiDir, 'inbox', 'triaged')).length, 2, 'both caps moved to triaged/');

  // after the post-apply sync, the new ticket is queryable in the cache.
  const { query } = await import('./q.mjs');
  const { rows } = await query('open', ['TST'], { dbPath, cwdRoot: dir });
  assert.ok(rows.some((r) => r.id === 'TST-T002'), 'the created ticket is in the cache after the sync');
});

test('--apply mints DISTINCT sequential ids for multiple creates in one batch (KIT-T009 collision guard)', async () => {
  const { plan } = await import('./triage/plan.mjs');
  const { apply } = await import('./triage/apply.mjs');

  cap('2026-06-02-0001-alpha-idea.md', 'first new untyped idea about parallax scrolling\n');
  cap('2026-06-02-0002-beta-idea.md', 'second new untyped idea about volumetric fog\n');
  await plan({ scopeFilter: 'TST', json: true, dbPath }); // hydrate the new caps into the cache

  const decisions = [
    { capId: 'TST-INBOX-2026-06-02-0001-alpha-idea', classification: 'feature', action: 'create' },
    { capId: 'TST-INBOX-2026-06-02-0002-beta-idea', classification: 'feature', action: 'create' },
  ];
  const decisionsPath = join(dir, 'decisions-batch.json');
  writeFileSync(decisionsPath, JSON.stringify(decisions));

  const result = await apply({ decisionsPath, json: true, dbPath });
  const ids = result.applied.filter((r) => r.action === 'create').map((r) => r.dest.match(/TST-T\d+/)[0]);

  assert.equal(ids.length, 2, 'both creates produced a ticket');
  assert.notEqual(ids[0], ids[1], 'two creates in ONE batch must not collide on the same id');
  // TST-T002 was minted by the prior test; the cache is not re-synced mid-batch, so the fix is
  // what makes these T003 and T004 instead of both T003.
  assert.deepEqual([...ids].sort(), ['TST-T003', 'TST-T004'], 'ids are sequential + distinct across the batch');
});

// --- commit.mjs (KIT-T045): apply commits its OWN output (created items + inbox→triaged moves) ---

function gitInit(root) {
  const g = (...a) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
  g('init', '-q');
  g('config', 'user.email', 'test@example.com');
  g('config', 'user.name', 'triage-test');
  g('config', 'commit.gpgsign', 'false');
}

// Mirror the file shape apply leaves behind (a written item + a cap moved into triaged/), then
// assert commitApply stages EXACTLY those paths, commits with the promote message, and stages the
// rename's deletion side (no stray cap left tracked in inbox/).
test('commit.mjs commits exactly the apply output with a descriptive message inside a data repo', async () => {
  const { commitApply } = await import('./triage/commit.mjs');
  const repo = mkdtempSync(join(tmpdir(), 'triage-commit-'));
  const ai = join(repo, '.ai');
  for (const s of ['inbox', 'tickets']) mkdirSync(join(ai, s), { recursive: true });
  // A pre-existing committed cap + an unrelated dirty file (must NOT be swept into the commit).
  const capRel = 'inbox/2026-06-03-0001-some-idea.md';
  writeFileSync(join(ai, capRel), 'an idea\n');
  writeFileSync(join(repo, 'unrelated.txt'), 'dirty\n');
  gitInit(repo);
  execFileSync('git', ['-C', repo, 'add', '--', `.ai/${capRel}`], { stdio: 'ignore' });
  execFileSync('git', ['-C', repo, 'commit', '-q', '-m', 'seed', '--', `.ai/${capRel}`], { stdio: 'ignore' });

  // Enact the move + a new item, exactly as apply does.
  const itemRel = 'tickets/TST-T010-some-idea.md';
  writeFileSync(join(ai, itemRel), '---\nid: TST-T010\n---\n\n## Description\nan idea\n');
  mkdirSync(join(ai, 'inbox', 'triaged'), { recursive: true });
  const movedRel = 'inbox/triaged/2026-06-03-0001-some-idea.md';
  renameSync(join(ai, capRel), join(ai, movedRel));

  const applied = [{ capId: 'x', scope: 'TST', action: 'create', dest: itemRel, movedTo: movedRel, capFile: capRel }];
  const committed = commitApply({ applied, aiDirByScope: new Map([['TST', ai]]) });

  assert.equal(committed.length, 1, 'one commit, in the data repo working tree');
  assert.match(committed[0].message, /^triage: promote 1 cap -> tickets\/decisions\/notes \[TST\]$/);

  const show = execFileSync('git', ['-C', repo, 'show', '--name-status', '--format=%s', 'HEAD'], { encoding: 'utf8' });
  assert.match(show, /triage: promote 1 cap/, 'commit subject is the promote message');
  assert.match(show, /A\s+\.ai\/tickets\/TST-T010-some-idea\.md/, 'the new item is in the commit');
  // The inbox→triaged move is committed: git records it as a rename (R) of the cap into triaged/,
  // so BOTH the original inbox path and the triaged path are present in the same staged change —
  // the deletion side is staged, never left loose for a later sync.
  assert.match(
    show,
    /R\d*\s+\.ai\/inbox\/2026-06-03-0001-some-idea\.md\s+\.ai\/inbox\/triaged\/2026-06-03-0001-some-idea\.md/,
    'the cap move (old → triaged) is committed as a rename',
  );
  assert.doesNotMatch(show, /unrelated\.txt/, 'unrelated dirty files are NOT swept in (no add -A)');

  // The unrelated file is still dirty (left for the Stop-hook sync), proving precision.
  const porcelain = execFileSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' });
  assert.match(porcelain, /unrelated\.txt/, 'unrelated change is left untouched');

  rmSync(repo, { recursive: true, force: true });
});

test('commit.mjs no-ops cleanly when the .ai store is not in any git repo (fail-open)', async () => {
  const { commitApply } = await import('./triage/commit.mjs');
  const bare = mkdtempSync(join(tmpdir(), 'triage-nogit-'));
  const ai = join(bare, '.ai');
  mkdirSync(join(ai, 'tickets'), { recursive: true });
  writeFileSync(join(ai, 'tickets', 'TST-T020-x.md'), 'x\n');
  const applied = [{ capId: 'x', scope: 'TST', action: 'create', dest: 'tickets/TST-T020-x.md', movedTo: null, capFile: null }];
  const committed = commitApply({ applied, aiDirByScope: new Map([['TST', ai]]) });
  assert.deepEqual(committed, [], 'no repo → nothing committed, no throw');
  rmSync(bare, { recursive: true, force: true });
});
