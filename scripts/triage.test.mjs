// triage.test.mjs — isolated tests for the programmatic triage script (KIT-T027). Every run gets a
// throwaway .ai fixture (a fresh TST scope), a throwaway registry (CLAUDE_KIT_REGISTRY), and a
// throwaway plugin root (CLAUDE_PLUGIN_ROOT → temp .cache), so the test NEVER writes the real
// cache or stores (KIT-T035). Assertions cover: --plan groups by scope, marks a (bug) cap
// deterministic with the config route, flags an untyped cap needsClassification, surfaces a dedup
// candidate, and opens the DB exactly once; --apply creates a ticket from a real next-id, folds on
// a fold action, moves the cap to triaged/, and lands the new item in the cache after the sync.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
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
