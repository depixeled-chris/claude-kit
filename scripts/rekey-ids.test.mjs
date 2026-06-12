#!/usr/bin/env node
// Tests for rekey-ids.mjs — verifies that --apply pushes the old id onto aka: (KIT-T091).
// Builds throwaway .ai fixtures in a temp dir and shells the CLI. exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REKEY = join(__dirname, 'rekey-ids.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];
function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

function project(tickets = {}) {
  const d = mkdtempSync(join(tmpdir(), 'kit-rekey-'));
  fixtures.push(d);
  mkdirSync(join(d, '.ai', 'tickets', 'archive'), { recursive: true });
  writeFileSync(join(d, '.ai', 'config.yml'), 'ids:\n  key: "HOD"\n  pad: 3\n');
  for (const [name, body] of Object.entries(tickets)) {
    writeFileSync(join(d, '.ai', 'tickets', name), body);
  }
  return d;
}

function run(root, key, flags = []) {
  return execFileSync(process.execPath, [REKEY, root, key, ...flags], { encoding: 'utf8' });
}

// After --apply, the renamed file should contain `aka: [R045]` (old id pushed).
const p1 = project({
  'R045-old-feature.md': `---\nid: R045\ntitle: old feature\ntype: feature\nstatus: todo\npriority: medium\nlabels: []\n---\nbody\n`,
});
run(p1, 'HOD', ['--apply']);
const renamedPath = join(p1, '.ai', 'tickets', 'HOD-T045-old-feature.md');
ok('file is renamed to HOD-T045-old-feature.md', existsSync(renamedPath));
const renamedContent = readFileSync(renamedPath, 'utf8');
ok('rekey adds old id R045 to aka:', renamedContent.includes('aka: [R045]'));

// If aka: already exists with a prior entry, the new old-id is appended (not replaced).
const p2 = project({
  'R046-another.md': `---\nid: R046\ntitle: another\ntype: feature\nstatus: todo\npriority: medium\naka: [OldLabel]\n---\nbody\n`,
});
run(p2, 'HOD', ['--apply']);
const p2Path = join(p2, '.ai', 'tickets', 'HOD-T046-another.md');
ok('file renamed to HOD-T046 when aka already exists', existsSync(p2Path));
const p2Content = readFileSync(p2Path, 'utf8');
ok('existing aka entry preserved alongside new old-id R046', p2Content.includes('OldLabel') && p2Content.includes('R046'));

// Dry run (no --apply) does NOT rename files and does NOT mutate frontmatter.
const p3 = project({
  'R047-dry.md': `---\nid: R047\ntitle: dry run\ntype: feature\nstatus: todo\npriority: medium\n---\nbody\n`,
});
run(p3, 'HOD'); // no --apply
const origPath = join(p3, '.ai', 'tickets', 'R047-dry.md');
ok('dry run leaves original file in place', existsSync(origPath));
const origContent = readFileSync(origPath, 'utf8');
ok('dry run does not add aka:', !origContent.includes('aka:'));

for (const d of fixtures) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
console.log(`\nrekey-ids: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
