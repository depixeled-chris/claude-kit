#!/usr/bin/env node
// Tests for id-utils.mjs — the markdown-served id allocator + integrity check.
// Builds throwaway .ai fixtures in a temp dir and asserts. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nextId, checkIds, scanStores, compareIds } from './id-utils.mjs';

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else { fail++; console.log('  FAIL  ' + name); }
}

// A fixture project: .ai/config.yml (key=HOD) + a tickets dir seeded with files.
function project(ticketFiles = {}, extra = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-id-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), 'ids:\n  key: "HOD"\n  prefix: "HOD-T"\n  pad: 3\n');
  for (const [name, id] of Object.entries(ticketFiles)) {
    writeFileSync(join(d, '.ai', 'tickets', name), `---\nid: ${id}\ntitle: x\n---\n`);
  }
  for (const [sub, files] of Object.entries(extra)) {
    mkdirSync(join(d, '.ai', sub), { recursive: true });
    for (const [name, id] of Object.entries(files)) {
      writeFileSync(join(d, '.ai', sub, name), `---\nid: ${id}\ntitle: x\n---\n`);
    }
  }
  return d;
}

// nextId = max trailing number + 1, padded, with the store letter.
const empty = project();
ok('nextId on empty store starts at 001', nextId(empty, 'tickets') === 'HOD-T001');

const seeded = project({
  'HOD-T004-a.md': 'HOD-T004',
  'HOD-T045-b.md': 'HOD-T045',
  'HOD-T012-c.md': 'HOD-T012',
});
ok('nextId tickets = max+1', nextId(seeded, 'tickets') === 'HOD-T046');
ok('nextId is per-store letter', nextId(seeded, 'decisions') === 'HOD-D001');
ok('nextId ignores gaps (max+1, not lowest-free)', nextId(seeded, 'tickets') !== 'HOD-T005');

// max+1 must also account for archived tickets, so a re-key never reuses a number.
const withArchive = project({ 'HOD-T002-a.md': 'HOD-T002' });
writeFileSync(join(withArchive, '.ai', 'tickets', 'archive', 'HOD-T009-old.md'), '---\nid: HOD-T009\ntitle: x\n---\n');
ok('nextId counts archived tickets', nextId(withArchive, 'tickets') === 'HOD-T010');

// Collision: two files, one id.
const collide = project({ 'HOD-T045-a.md': 'HOD-T045', 'HOD-T045-b.md': 'HOD-T045' });
const c = checkIds(collide);
ok('checkIds finds the duplicate', c.duplicates.length === 1 && c.duplicates[0].id === 'HOD-T045');
ok('checkIds lists both colliding files', c.duplicates[0].files.length === 2);
ok('reported paths are POSIX-style on every OS (no backslashes)',
  c.duplicates[0].files.every((f) => f.includes('/') && !f.includes('\\')));

// Mismatch: frontmatter id disagrees with filename.
const mism = project({ 'HOD-T050-a.md': 'HOD-T099' });
const m = checkIds(mism);
ok('checkIds finds the frontmatter/filename mismatch', m.mismatches.length === 1);
ok('mismatch reports both ids', m.mismatches[0].fmId === 'HOD-T099' && m.mismatches[0].fileId === 'HOD-T050');

// Clean store: no findings.
const clean = checkIds(seeded);
ok('clean store has no duplicates or mismatches', clean.duplicates.length === 0 && clean.mismatches.length === 0);

// scanStores reads across stores.
const multi = project({ 'HOD-T001-a.md': 'HOD-T001' }, { decisions: { 'HOD-D001-a.md': 'HOD-D001' } });
const items = scanStores(multi);
ok('scanStores spans tickets + decisions', items.some((i) => i.store === 'tickets') && items.some((i) => i.store === 'decisions'));

// pad is cosmetic: a store past 999 keeps allocating (no ceiling) and nextId widens.
const big = project({ 'HOD-T999-a.md': 'HOD-T999' });
ok('nextId past the pad width widens (no 999 ceiling)', nextId(big, 'tickets') === 'HOD-T1000');

// compareIds orders numerically, so width never breaks sort (the 999->1000 boundary).
ok('compareIds: 1000 sorts after 999 (not before, as a string compare would)', compareIds('HOD-T1000', 'HOD-T999') > 0);
ok('compareIds: 9 before 10', compareIds('HOD-T9', 'HOD-T10') < 0);
ok('compareIds: equal ids tie', compareIds('HOD-T5', 'HOD-T5') === 0);
ok('compareIds: different type letters order by prefix', compareIds('HOD-D9', 'HOD-T1') < 0);
ok('a lexical sort WOULD get the boundary wrong (proves the bug it fixes)', 'HOD-T1000'.localeCompare('HOD-T999') < 0);

// nextId on an unknown store throws (caught by the CLI).
let threw = false;
try { nextId(empty, 'bogus'); } catch { threw = true; }
ok('nextId rejects an unknown store', threw);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nid-utils: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
