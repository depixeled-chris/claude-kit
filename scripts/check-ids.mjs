#!/usr/bin/env node
// check-ids.mjs [repoRoot] — integrity over a project's .ai stores: duplicate ids
// (two files sharing one id) and frontmatter/filename id mismatches. Exit 1 on any
// problem, 0 when clean. repoRoot defaults to cwd.
//
//   node scripts/check-ids.mjs              # check cwd's .ai
//   node scripts/check-ids.mjs /d/dev/hustle-or-die
//
// The hooks import checkIds() from id-utils.mjs directly; this CLI is for ad-hoc
// runs and CI. This is the integrity half of KIT-T004 ("flags gaps + collisions").

import { checkIds } from './id-utils.mjs';

const root = process.argv[2] || process.cwd();
const { duplicates, mismatches } = checkIds(root);

if (!duplicates.length && !mismatches.length) {
  process.stdout.write(`check-ids: clean (${root})\n`);
  process.exit(0);
}
for (const d of duplicates) {
  process.stderr.write(`DUPLICATE id ${d.id}:\n  ${d.files.join('\n  ')}\n`);
}
for (const m of mismatches) {
  process.stderr.write(`MISMATCH ${m.file}: frontmatter id '${m.fmId}' != filename id '${m.fileId}'\n`);
}
process.exit(1);
