#!/usr/bin/env node
// Stop — keep the SQLite query cache fresh (KIT-T004). Once per turn, re-hydrate the
// derived cache IF a .ai store file is newer than the DB. Opt-in-aware (no-ops unless the
// repo has .ai/) and fail-open: any error — including no SQLite engine — just skips. The
// cache is optional; a refresh must NEVER wedge a session, and this is OUT of the hot-path
// enforcement hooks (it runs on Stop, alongside code-graph, not on PreToolUse/commit).
//
// Mirrors hooks/code-graph.mjs's lazy-staleness pattern. The DB location follows the
// ticket: <kit-root>/.cache/workflow.db (gitignored), not a machine-local dir.

import { gitRoot, adopted } from './lib.mjs';

try {
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const { hydrate, defaultDbPath } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ root, dbPath: defaultDbPath(), ifStale: true });
  if (r && r.ok && !r.skipped) {
    process.stderr.write(`[hydrate-cache] refreshed ${r.items} items -> ${r.dbPath}\n`);
  }
} catch {
  process.exit(0); // fail-open — the cache is never a hard dependency
}
