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

// --- provenance fields: produced_by / informs / introduced_by (KIT-T095) ---

// A source doc with informs: [...] gets a downward rollup under its row; the informed
// items each get an upward ← produced_by marker on their row.
const withProvenanceInforms = project({
  'HOD-R067-research.md': `---\nid: HOD-R067\ntitle: research doc\ntype: request\nstatus: done\npriority: medium\ninforms: [HOD-T127, HOD-T128]\n---\n`,
  'HOD-T127-child1.md': `---\nid: HOD-T127\ntitle: work item one\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: HOD-R067\n---\n`,
  'HOD-T128-child2.md': `---\nid: HOD-T128\ntitle: work item two\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: HOD-R067\n---\n`,
});
await regenerateIndexes(withProvenanceInforms);
const idx9 = readIndex(withProvenanceInforms);
ok('source doc with informs: gets downward rollup listing HOD-T127', idx9.includes('HOD-T127') && idx9.includes('informs'));
ok('source doc rollup also lists HOD-T128', idx9.includes('HOD-T128'));
ok('produced item HOD-T127 shows upward marker ← produced_by HOD-R067', idx9.includes('← produced_by HOD-R067'));
ok('produced item HOD-T128 also shows upward marker', idx9.split('← produced_by HOD-R067').length >= 3); // source row + 2 child rows

// A source doc where produced_by is set — the source renders a ↳ produced: rollup.
const withProducedBy = project({
  'HOD-R070-doc.md': `---\nid: HOD-R070\ntitle: design doc\ntype: request\nstatus: done\npriority: medium\n---\n`,
  'HOD-T130-impl.md': `---\nid: HOD-T130\ntitle: implementation\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: HOD-R070\n---\n`,
});
await regenerateIndexes(withProducedBy);
const idx10 = readIndex(withProducedBy);
ok('source doc gets ↳ produced: rollup when children set produced_by', idx10.includes('produced'));
ok('implementation item shows upward ← produced_by HOD-R070 marker', idx10.includes('← produced_by HOD-R070'));

// introduced_by surfaces in the REGRESSIONS view alongside causing_commit.
function readReg(root) { return readFileSync(join(root, '.ai', 'REGRESSIONS.md'), 'utf8'); }
const withIntroducedBy = project({
  'HOD-T050-original.md': `---\nid: HOD-T050\ntitle: original bug\ntype: bug\nstatus: done\npriority: medium\n---\n`,
  'HOD-T051-regression.md': `---\nid: HOD-T051\ntitle: regression of original\ntype: regression\nstatus: todo\npriority: high\nregressed_from: HOD-T050\nintroduced_by: HOD-T040@abc1234\ncausing_commit: def5678\n---\n`,
});
await regenerateIndexes(withIntroducedBy);
const reg1 = readReg(withIntroducedBy);
ok('introduced_by surfaces in REGRESSIONS view', reg1.includes('introduced by HOD-T040@abc1234'));
ok('causing_commit still appears alongside introduced_by', reg1.includes('caused by def5678'));

// A dangling provenance ref (produced_by pointing at a missing id) must not crash.
const danglingProvenance = project({
  'HOD-T135-orphan.md': `---\nid: HOD-T135\ntitle: orphan with dangling provenance\ntype: feature\nstatus: todo\npriority: medium\nproduced_by: HOD-MISSING-999\ninforms: [HOD-MISSING-998]\n---\n`,
});
let danglingProvOk = false;
try {
  await regenerateIndexes(danglingProvenance);
  const idx11 = readIndex(danglingProvenance);
  danglingProvOk = idx11.includes('HOD-T135');
} catch {
  danglingProvOk = false;
}
ok('dangling provenance ref does not crash the board', danglingProvOk);

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nindex-tickets: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
