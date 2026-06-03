#!/usr/bin/env node
// next-id.mjs <store> [repoRoot] — print the next free id for a store, so capture
// tooling (and the agent) never hand-picks one. <store> is tickets|decisions|
// notes|questions; repoRoot defaults to cwd (the .ai is found at <root>/.ai).
//
//   node scripts/next-id.mjs tickets            # -> HOD-T049
//   node scripts/next-id.mjs decisions /d/dev/claude-kit
//
// This is the allocation half of KIT-T004 (markdown-served; the SQLite cache only
// makes it O(1) later). Pair with check-ids.mjs for the integrity half.

import { nextId } from './id-utils.mjs';

const [, , store, root] = process.argv;
if (!store) {
  console.error('usage: next-id.mjs <tickets|decisions|notes|questions> [repoRoot]');
  process.exit(2);
}
try {
  process.stdout.write(nextId(root || process.cwd(), store) + '\n');
} catch (e) {
  console.error('next-id: ' + e.message);
  process.exit(1);
}
