#!/usr/bin/env node
// Stop — keep the SQLite query cache fresh (KIT-T004). Once per turn, re-hydrate the
// derived cache IF a .ai store file is newer than the DB. Opt-in-aware (no-ops unless the
// repo has .ai/) and fail-open: any error — including no SQLite engine — just skips. The
// cache is optional; a refresh must NEVER wedge a session, and this is OUT of the hot-path
// enforcement hooks (it runs on Stop, alongside code-graph, not on PreToolUse/commit).
//
// Mirrors hooks/code-graph.mjs's lazy-staleness pattern. The DB location follows the
// ticket: <kit-root>/.cache/workflow.db (gitignored), not a machine-local dir.
//
// CROSS-SCOPE (KIT-T031): hydrate ALL registered scopes into the one shared DB — never just
// gitRoot(), which made the single shared cache last-writer-wins per repo. We still gate on
// the current repo being adopted (the Stop hook only fires inside a tracked project), but the
// rebuild itself unions every scope so a query from any cwd sees them all.

import { gitRoot, adopted } from './lib.mjs';

try {
  if (!adopted(gitRoot())) process.exit(0);

  const { hydrate, defaultDbPath } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ dbPath: defaultDbPath(), ifStale: true }); // no root → all scopes
  if (r && r.ok && !r.skipped) {
    process.stderr.write(`[hydrate-cache] refreshed ${r.items} items across ${r.scopes} scope(s) -> ${r.dbPath}\n`);
  }
} catch {
  process.exit(0); // fail-open — the cache is never a hard dependency
}
