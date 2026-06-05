// triage/handle.mjs — the held-open cache handle (KIT-D025: amortize the per-process open over
// the many dedup searches a triage pass runs; never shell out to q.mjs per cap). Hydrate-if-stale
// first so the inbox the plan reads is current, then hand back ONE handle the caller closes.

import { resolveEngine } from '../db-engine.mjs';
import { hydrate } from '../hydrate-db.mjs';

// Returns a single db handle, or null when no SQLite engine exists — triage requires the cache
// (its whole point is the cross-scope inbox query + held-open dedup), so callers error out on null.
export async function openHandle(dbPath) {
  const open = await resolveEngine();
  if (!open) return null;
  await hydrate({ dbPath, ifStale: true });
  return open(dbPath);
}
