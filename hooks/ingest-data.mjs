#!/usr/bin/env node
// PostToolUse (Write|Edit) — IMMEDIATE incremental ingest (KIT-T026/KIT-D024). When an edit
// lands a file under a managed repo's .ai store, sync THAT scope's cache right away, so a
// query in the same turn already sees the new/changed item (no waiting for the Stop hook's
// cross-scope refresh). The sync is incremental (manifest-diff), so this touches only the one
// file that changed — cheap enough to run per-write.
//
// FAIL-OPEN: a sync error (or no engine, or a non-store path) must NEVER wedge the tool call.
// Every path exits 0; the worst case is a slightly stale cache the Stop-hook refresh repairs.

import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { payload } from './lib.mjs';

// The nearest ancestor of `start` whose <dir>/.ai/config.yml exists — the project root whose
// store the file belongs to. Mirrors cap.mjs's walk so capture + ingest agree on "which store".
function findRoot(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.ai', 'config.yml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

try {
  const p = await payload();
  const file = (p.tool_input && p.tool_input.file_path) || '';
  if (!file) process.exit(0);

  const norm = resolve(file);
  const root = findRoot(dirname(norm));
  if (!root) process.exit(0); // not under any managed .ai store

  // Only ingest edits that actually live INSIDE that root's .ai store dir (a sibling source
  // file, e.g. README, is not a tracked item — skip it without a sync).
  const aiDir = join(root, '.ai');
  if (!(norm + sep).startsWith(resolve(aiDir) + sep)) process.exit(0);

  const { hydrate, defaultDbPath } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ root, dbPath: defaultDbPath() });
  if (r && r.ok && (r.reparsed || r.deleted)) {
    process.stderr.write(`[ingest-data] synced ${root} (+${r.reparsed} ~${r.deleted})\n`);
  }
} catch {
  /* fail-open — the cache is never a hard dependency, and the Stop refresh repairs drift */
}
process.exit(0);
