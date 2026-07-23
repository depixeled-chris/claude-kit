#!/usr/bin/env node
// Route-level tests for the KIT-T131 API. Drives the REAL Express app over HTTP against a
// THROWAWAY fixture project store (never the real registry or the real cache): the DB path is
// redirected under a temp CLAUDE_PLUGIN_ROOT and discovery is a static fixture. Proves the
// cache-READ / markdown-WRITE round-trip end to end — a POSTed comment is durable in markdown
// and shows up on the next cache-served GET — plus the guards (human_only, evidence floor) and
// the 127.0.0.1-only bind. Registered in the kit's `npm test`.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Isolate the cache path (CLAUDE_PLUGIN_ROOT drives defaultDbPath) and the registry BEFORE any
// module reads them at call time.
const pluginRoot = mkdtempSync(join(tmpdir(), 'kit-api-plugin-'));
process.env.CLAUDE_PLUGIN_ROOT = pluginRoot;

const { defaultDbPath } = await import('../scripts/hydrate-db.mjs');
const { buildApp } = await import('./app.mjs');
const { createStaticDiscovery } = await import('./services/discovery.mjs');
const { resolveConfig } = await import('./config.mjs');

const cleanups = [pluginRoot];
function tmp(prefix) {
  const d = mkdtempSync(join(tmpdir(), prefix));
  cleanups.push(d);
  return d;
}

const CONFIG_YML = `classifications:
  feature: { routes_to: backlog }
statuses:
  flow: [todo, doing, review, done]
  human_only: [done]
  off_board: [superseded]
uat:
  default: required
history:
  archive_done_to: tickets/archive
  events: [created, status, comment, decision, blocker, unblocked, fixed, regressed]
ids:
  key: "TST"
  prefix: "TST-T"
  pad: 3
`;

const ticketDoc = (id, { ac, notes }) => `---
id: ${id}
title: seed ${id}
type: feature
status: doing
priority: high
milestone: M1
links: []
supersedes:
superseded_by:
---

## Description
Seed description for ${id}.

## Acceptance Criteria
${ac}

## Notes
${notes}

## History
- [2026-07-23 10:00] (created) feature — seed ${id}
`;

// ---- fixture: an in-repo project store the write path can mutate ----
function makeFixture() {
  const root = tmp('kit-api-fix-');
  const ai = join(root, '.ai');
  for (const d of ['tickets/archive', 'questions', 'decisions', 'inbox']) mkdirSync(join(ai, d), { recursive: true });
  writeFileSync(join(ai, 'config.yml'), CONFIG_YML);
  writeFileSync(join(ai, 'tickets', 'TST-T001-seed.md'),
    ticketDoc('TST-T001', { ac: '- [x] first criterion\n- [ ] second criterion', notes: 'initial progress note.' }));
  writeFileSync(join(ai, 'tickets', 'TST-T002-seed.md'),
    ticketDoc('TST-T002', { ac: '- [ ] only criterion', notes: 'no evidence here.' }));
  writeFileSync(join(ai, 'tickets', 'TST-T003-seed.md'),
    ticketDoc('TST-T003', { ac: '- [ ] verified', notes: 'verified via scripts/sample.test.mjs — suite green.' }));
  writeFileSync(join(ai, 'questions', 'TST-Q001-q.md'), '---\nid: TST-Q001\ntitle: a question\nstatus: open\n---\n');
  writeFileSync(join(ai, 'decisions', 'TST-D001-d.md'), '---\nid: TST-D001\ntitle: a decision\ndate: 2026-07-23\n---\n');
  writeFileSync(join(ai, 'inbox', '2026-07-23-1000-a-cap.md'), '(bug) something to triage\n');
  return root;
}

// ---- fixture: a central notebook for the waiting board (survey discovery) ----
function makeWaitingRegistry() {
  const dataRoot = tmp('kit-api-data-');
  const nb = join(dataRoot, 'projects', 'wtproj');
  mkdirSync(join(nb, 'tickets'), { recursive: true });
  writeFileSync(join(nb, 'config.yml'), 'ids:\n  key: "WT"\n  prefix: "WT-T"\n  pad: 3\n');
  writeFileSync(join(nb, 'tickets', 'WT-T001-r.md'),
    '---\nid: WT-T001\ntitle: waiting item\nstatus: review\n---\n');
  const reg = join(tmp('kit-api-reg-'), 'registry.json');
  writeFileSync(reg, JSON.stringify({ dataRoot, projects: {} }));
  return reg;
}

process.env.CLAUDE_KIT_REGISTRY = makeWaitingRegistry();

const fixtureRoot = makeFixture();
const discovery = createStaticDiscovery([
  { key: 'TST', name: 'test-proj', root: fixtureRoot, aiDir: join(fixtureRoot, '.ai') },
]);
const config = {
  host: '127.0.0.1',
  port: 0,
  corsOrigin: 'http://localhost:5173',
  dbPath: defaultDbPath(),
  hydrateRoot: fixtureRoot,
  discovery,
};

const app = buildApp(config);
const server = app.listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

after(() => {
  server.close();
  for (const d of cleanups) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
});

async function get(path, headers) {
  const res = await fetch(base + path, { headers });
  return { status: res.status, headers: res.headers, body: await res.json() };
}
async function post(path, payload) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json() };
}

// ---- binding + CORS config ----
test('binds 127.0.0.1 only + CORS scoped to the Vite origin', async () => {
  assert.equal(config.host, '127.0.0.1');
  assert.equal(resolveConfig().host, '127.0.0.1');
  assert.equal(server.address().address, '127.0.0.1');
  const r = await get('/health', { origin: 'http://localhost:5173' });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), 'http://localhost:5173');
});

test('GET /health reports ok', async () => {
  const r = await get('/health');
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'ok');
});

// ---- reads served from the cache ----
test('GET /api/projects lists the adopted project with open/review counts', async () => {
  const r = await get('/api/projects');
  assert.equal(r.status, 200);
  const tst = r.body.data.find((p) => p.key === 'TST');
  assert.ok(tst, 'TST project present');
  assert.equal(tst.name, 'test-proj');
  assert.equal(tst.openCount, 3);
  assert.equal(tst.reviewCount, 0);
});

test('GET /api/projects/:key/tickets lists tickets, ?status filters', async () => {
  const all = await get('/api/projects/TST/tickets');
  assert.equal(all.status, 200);
  const ids = all.body.data.map((t) => t.id);
  assert.deepEqual(ids, ['TST-T001', 'TST-T002', 'TST-T003']);
  const doing = await get('/api/projects/TST/tickets?status=doing');
  assert.equal(doing.body.data.length, 3);
  const review = await get('/api/projects/TST/tickets?status=review');
  assert.equal(review.body.data.length, 0);
});

test('GET /api/projects/:key/tickets/:id returns frontmatter + AC checked state + sections', async () => {
  const r = await get('/api/projects/TST/tickets/TST-T001');
  assert.equal(r.status, 200);
  assert.equal(r.body.meta.cached, true);
  const d = r.body.data;
  assert.equal(d.id, 'TST-T001');
  assert.equal(d.status, 'doing');
  assert.equal(d.milestone, 'M1');
  assert.match(d.description, /Seed description for TST-T001/);
  assert.deepEqual(d.acceptanceCriteria, [
    { text: 'first criterion', checked: true },
    { text: 'second criterion', checked: false },
  ]);
  assert.match(d.notes, /initial progress note/);
  assert.ok(d.history.some((h) => h.event === 'created'));
  assert.deepEqual(d.comments, []);
});

test('GET list endpoints for questions / decisions / inbox', async () => {
  const q = await get('/api/projects/TST/questions');
  assert.ok(q.body.data.some((x) => x.id === 'TST-Q001'));
  const dec = await get('/api/projects/TST/decisions');
  assert.ok(dec.body.data.some((x) => x.id === 'TST-D001'));
  const inbox = await get('/api/projects/TST/inbox');
  assert.ok(inbox.body.data.length >= 1);
});

// ---- markdown-WRITE → cache-READ round-trip ----
test('POST comment is durable in markdown and shows on the next cache-served GET', async () => {
  const posted = await post('/api/projects/TST/tickets/TST-T001/comments', { text: 'please review @bob', author: 'chris' });
  assert.equal(posted.status, 201);
  assert.equal(posted.body.data.ref, 'TST-T001#1');
  assert.deepEqual(posted.body.data.mentions, ['bob']);

  const detail = await get('/api/projects/TST/tickets/TST-T001?agent=bob');
  assert.equal(detail.body.data.comments.length, 1);
  const c = detail.body.data.comments[0];
  assert.equal(c.text, 'please review @bob');
  assert.equal(c.author, 'chris');
  assert.deepEqual(c.mentions, ['bob']);
  assert.equal(c.unread, true); // @bob hasn't acked
});

test('POST status (allowed transition) round-trips through the cache', async () => {
  const posted = await post('/api/projects/TST/tickets/TST-T003/status', { status: 'review', agent: 'claude' });
  assert.equal(posted.status, 200);
  assert.equal(posted.body.data.to, 'review');
  const detail = await get('/api/projects/TST/tickets/TST-T003');
  assert.equal(detail.body.data.status, 'review');
  const projects = await get('/api/projects');
  assert.equal(projects.body.data.find((p) => p.key === 'TST').reviewCount, 1);
});

// ---- guards return a typed 4xx, never a 500 ----
test('POST status to a human_only state is refused with 403', async () => {
  const r = await post('/api/projects/TST/tickets/TST-T001/status', { status: 'done', agent: 'claude' });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'human_only');
  assert.match(r.body.error.message, /human_only|--human/);
});

test('POST status to the closing state without test evidence is refused with 422', async () => {
  const r = await post('/api/projects/TST/tickets/TST-T002/status', { status: 'review', agent: 'claude' });
  assert.equal(r.status, 422);
  assert.equal(r.body.error.code, 'evidence_floor');
});

// ---- not-found mapping ----
test('unknown project → 404, unknown ticket → 404', async () => {
  assert.equal((await get('/api/projects/ZZZ/tickets')).status, 404);
  assert.equal((await get('/api/projects/TST/tickets/TST-T999')).status, 404);
});

// ---- cross-project waiting board (survey.mjs data) ----
test('GET /api/waiting surfaces a review ticket from a central notebook', async () => {
  const r = await get('/api/waiting');
  assert.equal(r.status, 200);
  const wt = r.body.data.find((b) => b.project === 'wtproj');
  assert.ok(wt, 'wtproj on the waiting board');
  assert.ok(wt.items.some((i) => i.kind === 'review' && i.id === 'WT-T001'));
});
