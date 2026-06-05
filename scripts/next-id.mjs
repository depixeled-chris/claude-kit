#!/usr/bin/env node
// next-id.mjs <store> [repoRoot] — print the next free id for a store, so capture
// tooling (and the agent) never hand-picks one. <store> is tickets|decisions|
// notes|questions; repoRoot defaults to cwd (the .ai is found at <root>/.ai).
//
//   node scripts/next-id.mjs tickets            # -> HOD-T049
//   node scripts/next-id.mjs decisions /d/dev/claude-kit
//
// This is the allocation half of KIT-T004. It now serves from the SQLite cache's O(1)
// `next-id` query (KIT-T026) and FALLS BACK to the markdown `nextId` scan when no engine
// or DB is present — same answer either way (the cache is derived from the same scan).
// Pair with check-ids.mjs for the integrity half.

import { nextId, readIdConfig, STORE_TYPE } from './id-utils.mjs';
import { query } from './q.mjs';

const [, , store, rootArg] = process.argv;
if (!store) {
  console.error('usage: next-id.mjs <tickets|decisions|notes|questions> [repoRoot]');
  process.exit(2);
}
const root = rootArg || process.cwd();

try {
  // Validate the store + read this project's id key up front (cheap config read, no file
  // scan) — the cache groups by scope = the id key, and a bad store must still fail fast.
  if (!STORE_TYPE[store]) {
    throw new Error(`unknown store '${store}' (one of: ${Object.keys(STORE_TYPE).join(', ')})`);
  }
  const { key } = readIdConfig(root);
  if (!key) throw new Error(`no ids.key in ${root}/.ai/config.yml`);

  // O(1) cache path (KIT-T026): --root pins the local scope so next-id derives from THIS
  // project's counter even though the shared cache is cross-scope. Falls back to the full
  // markdown scan (nextId) when no engine/DB is present — same answer, derived from the
  // same items.
  const { rows, cached } = await query('next-id', [key, store], { root });
  const id = cached && rows[0] && rows[0].id ? rows[0].id : nextId(root, store);
  process.stdout.write(id + '\n');
} catch (e) {
  console.error('next-id: ' + e.message);
  process.exit(1);
}
