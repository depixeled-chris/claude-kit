// Cache-READ layer (KIT-D044). Every read is served from the per-project SQLite FTS5 cache
// through q.mjs's dbOpen — which verifies staleness and REHYDRATES from the markdown truth
// before answering, exactly as the CLI does. The API never opens the DB any other way and
// never writes it. `openFresh` hands back a fresh handle (caller closes); the fetchers are
// pure reads over it with EXPLICIT columns and bound `?` params (no SELECT *, no string SQL).

import { dbOpen } from '../../scripts/q.mjs';
import { ApiError } from '../lib/errors.mjs';
import { STATUS } from '../lib/status.mjs';

// One place naming the open lifecycle statuses, so the counts + list queries agree.
const OPEN_STATUSES = ['todo', 'doing', 'review'];
const OPEN_PLACEHOLDERS = OPEN_STATUSES.map(() => '?').join(',');

export async function openFresh(config) {
  const { handle, wasStale } = await dbOpen(config.hydrateRoot, config.dbPath);
  if (!handle) {
    throw new ApiError(STATUS.SERVER_ERROR, 'no SQLite engine — cannot serve from the cache', 'no_cache');
  }
  return { handle, wasStale };
}

// Single-shot: open fresh, run fn(handle), always close.
export async function withCache(config, fn) {
  const { handle, wasStale } = await openFresh(config);
  try {
    return await fn(handle, { wasStale });
  } finally {
    handle.close();
  }
}

// Open/review ticket counts for one scope.
export function fetchCounts(handle, key) {
  const rows = handle.all(
    `SELECT status, COUNT(*) AS n FROM items
     WHERE scope = ? AND store = 'tickets' AND archived = 0 AND status IN (${OPEN_PLACEHOLDERS})
     GROUP BY status`,
    [key, ...OPEN_STATUSES],
  );
  let open = 0;
  let review = 0;
  for (const r of rows) {
    open += r.n;
    if (r.status === 'review') review = r.n;
  }
  return { open, review };
}

// A scope's tickets, optionally filtered to one status. Active board only (archived excluded).
export function fetchTickets(handle, key, status) {
  const where = ['scope = ?', "store = 'tickets'", 'archived = 0'];
  const params = [key];
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  return handle.all(
    `SELECT id, type, status, priority, title, milestone FROM items
     WHERE ${where.join(' AND ')}`,
    params,
  );
}

// One ticket's cache rows: the item, its stored body (FTS copy), history events, and edges.
// Returns null when the id is absent from the scope.
export function fetchTicket(handle, key, id) {
  const item = handle.all(
    `SELECT id, scope, store, type, status, priority, title, parent, milestone, num, archived, file
     FROM items WHERE id = ? AND scope = ?`,
    [id, key],
  )[0];
  if (!item) return null;
  const bodyRow = handle.all('SELECT body FROM items_fts WHERE id = ?', [id])[0];
  const history = handle.all(
    'SELECT ts, event, detail FROM history WHERE item_id = ? ORDER BY ts',
    [id],
  );
  const links = handle.all('SELECT rel, to_id FROM links WHERE from_id = ?', [id]);
  return { item, body: bodyRow ? bodyRow.body : '', history, links };
}

// A scope's items in a non-ticket store (questions | decisions | inbox | notes …).
export function fetchStore(handle, key, store) {
  return handle.all(
    `SELECT id, type, status, title FROM items
     WHERE scope = ? AND store = ? AND archived = 0`,
    [key, store],
  );
}
