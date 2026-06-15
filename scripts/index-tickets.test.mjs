#!/usr/bin/env node
// Tests for index-tickets.mjs — board generation, focusing on aka: alias rendering (KIT-T091).
// Builds throwaway .ai fixtures in a temp dir. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { regenerateIndexes } from './index-tickets.mjs';

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

function project(tickets = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-idx-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), 'ids:\n  key: "HOD"\n  pad: 3\n');
  for (const [name, body] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', name), body);
  }
  return d;
}

function readIndex(root) {
  return readFileSync(join(root, '.ai', 'tickets', 'INDEX.md'), 'utf8');
}

// A ticket WITH aka: [R045] should render `· was R045` in the board row.
const withAka = project({
  'HOD-T045-foo.md': `---\nid: HOD-T045\ntitle: foo feature\ntype: feature\nstatus: todo\npriority: medium\naka: [R045]\n---\n`,
});
await regenerateIndexes(withAka);
const idx1 = readIndex(withAka);
ok('aka single alias renders "· was R045" in board row', idx1.includes('· was R045'));
ok('board row contains ticket id HOD-T045', idx1.includes('HOD-T045'));

// A ticket with multiple aliases renders them joined.
const multiAka = project({
  'HOD-T046-bar.md': `---\nid: HOD-T046\ntitle: bar feature\ntype: feature\nstatus: todo\npriority: medium\naka: [R045, R046]\n---\n`,
});
await regenerateIndexes(multiAka);
const idx2 = readIndex(multiAka);
ok('multiple aka aliases all appear in board row', idx2.includes('R045') && idx2.includes('R046'));
ok('multi-aka row contains "· was"', idx2.includes('· was'));

// A ticket WITHOUT aka: should NOT have "· was" in its row.
const noAka = project({
  'HOD-T047-baz.md': `---\nid: HOD-T047\ntitle: baz feature\ntype: feature\nstatus: todo\npriority: medium\n---\n`,
});
await regenerateIndexes(noAka);
const idx3 = readIndex(noAka);
ok('ticket without aka has no "· was" suffix', !idx3.includes('· was'));

// An empty aka: [] should also produce no suffix.
const emptyAka = project({
  'HOD-T048-qux.md': `---\nid: HOD-T048\ntitle: qux feature\ntype: feature\nstatus: todo\npriority: medium\naka: []\n---\n`,
});
await regenerateIndexes(emptyAka);
const idx4 = readIndex(emptyAka);
ok('empty aka: [] produces no "· was" suffix', !idx4.includes('· was'));

// --- parent: hierarchy tests (KIT-T094) ---

// A parent item with two children → the board renders the downward rollup under the parent row.
const withParent = project({
  'HOD-R067-epic.md': `---\nid: HOD-R067\ntitle: epic request\ntype: request\nstatus: todo\npriority: medium\n---\n`,
  'HOD-T127-child1.md': `---\nid: HOD-T127\ntitle: child one\ntype: feature\nstatus: todo\npriority: medium\nparent: HOD-R067\n---\n`,
  'HOD-T128-child2.md': `---\nid: HOD-T128\ntitle: child two\ntype: feature\nstatus: todo\npriority: medium\nparent: HOD-R067\n---\n`,
});
await regenerateIndexes(withParent);
const idx5 = readIndex(withParent);
ok('parent item row appears in board', idx5.includes('HOD-R067'));
ok('parent item gets downward rollup listing HOD-T127', idx5.includes('HOD-T127') && idx5.includes('children'));
ok('parent item rollup also lists HOD-T128', idx5.includes('HOD-T128'));
ok('child HOD-T127 shows upward parent marker ↳ HOD-R067', idx5.includes('↳ HOD-R067'));
ok('child HOD-T128 also shows upward parent marker', idx5.split('↳ HOD-R067').length >= 3); // parent row + 2 child rows

// A child with parent: renders upward marker.
const childUpward = project({
  'HOD-R070-parent.md': `---\nid: HOD-R070\ntitle: parent item\ntype: request\nstatus: todo\npriority: medium\n---\n`,
  'HOD-T130-child.md': `---\nid: HOD-T130\ntitle: child item\ntype: feature\nstatus: todo\npriority: medium\nparent: HOD-R070\n---\n`,
});
await regenerateIndexes(childUpward);
const idx6 = readIndex(childUpward);
ok('child row contains upward parent marker ↳ HOD-R070', idx6.includes('↳ HOD-R070'));

// A dangling parent: (target missing) must NOT crash the board.
const danglingParent = project({
  'HOD-T131-orphan.md': `---\nid: HOD-T131\ntitle: orphan child\ntype: feature\nstatus: todo\npriority: medium\nparent: HOD-MISSING-999\n---\n`,
});
let danglingOk = false;
try {
  await regenerateIndexes(danglingParent);
  const idx7 = readIndex(danglingParent);
  danglingOk = idx7.includes('HOD-T131');
} catch {
  danglingOk = false;
}
ok('dangling parent does not crash the board', danglingOk);

// A ticket WITHOUT parent: should NOT have ↳ upward marker.
const noParent = project({
  'HOD-T132-standalone.md': `---\nid: HOD-T132\ntitle: standalone\ntype: feature\nstatus: todo\npriority: medium\n---\n`,
});
await regenerateIndexes(noParent);
const idx8 = readIndex(noParent);
ok('ticket without parent has no upward ↳ marker', !idx8.includes('↳'));

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nindex-tickets: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
