#!/usr/bin/env node
// rekey-ids.mjs <repoRoot> <PROJECT_KEY> [--apply]
//
// Re-key every .ai store ID to the <KEY>-<TYPE><NUM> scheme (e.g. R045 -> HOD-T045,
// DEC-003 -> HOD-D003, D-010 -> KIT-D010). The type letter is the STORE (ticket=T,
// decision=D, note=N, question=Q); the project KEY prefixes it so an id reads sensibly in a
// cross-project rundown. The trailing number is preserved (re-padded), so old refs still map.
//
// Dry-run by default — prints the map and exits. Pass --apply to rename files + rewrite refs.
// References are rewritten across .ai/, docs/, and root-level *.md only (not source/code).
// NOTE: a project whose .ai is a junction lands those edits in the DATA repo — commit there.

import { readdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, extname } from 'node:path';

const [, , repo, KEY, flag] = process.argv;
if (!repo || !KEY) {
  console.error('usage: rekey-ids.mjs <repoRoot> <KEY> [--apply]');
  process.exit(2);
}
const APPLY = flag === '--apply';
const PAD = 3;
const STORE_TYPE = { tickets: 'T', decisions: 'D', notes: 'N', questions: 'Q' };
const SKIP = new Set(['_TEMPLATE.md', 'README.md', 'INDEX.md', 'REGRESSIONS.md', 'ROADMAP.md']);
const ai = join(repo, '.ai');

const map = new Map(); // oldId -> { newId, subdir, file }
for (const [store, typeLetter] of Object.entries(STORE_TYPE)) {
  // archived tickets live under tickets/archive — re-key them too, so history stays consistent
  const subdirs = store === 'tickets' ? ['tickets', join('tickets', 'archive')] : [store];
  for (const subdir of subdirs) {
    let files;
    try {
      files = readdirSync(join(ai, subdir));
    } catch {
      continue; // store/subdir not present in this project
    }
    for (const f of files) {
      if (extname(f) !== '.md' || SKIP.has(f)) continue;
      const m = f.match(/^([A-Za-z]+-?\d+)/); // R045 / DEC-003 / N-001 / D-010 / T-001
      if (!m) continue;
      const oldId = m[1];
      const num = oldId.match(/\d+$/)[0].padStart(PAD, '0');
      map.set(oldId, { newId: `${KEY}-${typeLetter}${num}`, subdir, file: f });
    }
  }
}

// Longest oldId first so a 3-letter prefix (DEC-001) is matched before a 1-letter one (D-001).
const ordered = [...map.keys()].sort((a, b) => b.length - a.length);
console.log(`# ${KEY}: ${map.size} ids`);
for (const o of ordered) console.log(`  ${o.padEnd(8)} -> ${map.get(o).newId}`);
if (!APPLY) {
  console.log('\n(dry run — pass --apply to execute)');
  process.exit(0);
}

for (const [oldId, info] of map) {
  const newName = info.file.replace(oldId, info.newId);
  if (newName !== info.file) renameSync(join(ai, info.subdir, info.file), join(ai, info.subdir, newName));
}

function collectMd(dir, acc) {
  let ents;
  try {
    ents = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of ents) {
    if (e.isDirectory()) {
      if (e.name !== '.git' && e.name !== 'node_modules') collectMd(join(dir, e.name), acc);
    } else if (extname(e.name) === '.md') {
      acc.push(join(dir, e.name));
    }
  }
  return acc;
}
const mdFiles = [];
collectMd(ai, mdFiles);
collectMd(join(repo, 'docs'), mdFiles);
for (const f of readdirSync(repo)) if (extname(f) === '.md') mdFiles.push(join(repo, f));

let edits = 0;
for (const f of mdFiles) {
  let text = readFileSync(f, 'utf8');
  let changed = false;
  for (const oldId of ordered) {
    const re = new RegExp(`\\b${oldId.replace(/-/g, '\\-')}\\b`, 'g');
    if (re.test(text)) {
      text = text.replace(re, map.get(oldId).newId);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(f, text);
    edits++;
  }
}
console.log(`\napplied: renamed ${map.size} files, rewrote refs in ${edits} md files`);
