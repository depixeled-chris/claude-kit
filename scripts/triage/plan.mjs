// triage/plan.mjs — GATHER (KIT-T027 step 1). Query EVERY store='inbox' cap from the cache on the
// ONE held-open handle, split DETERMINISTIC (explicit (type) → config route+priority, no LLM) from
// AMBIGUOUS (untyped prose → needsClassification), and attach dedup candidates per cap. Emits the
// structured triage-plan the LLM classifier consumes. The single-handle requirement is asserted by
// reporting dbHandleOpens: 1 — every query below runs on the handle the caller passes in.

import { openHandle } from './handle.mjs';
import { loadScope, scopeIndex, ROUTE_STORE } from './config.mjs';
import { leadingType, capText, ftsOrQuery, truncate } from './cap-text.mjs';

const DEDUP_LIMIT = 8;          // candidate dedup hits per cap — a hint list, not a dump
const PROBE_STORE = 'tickets';  // store an ambiguous cap dedup-probes before its route is known
const TEXT_COL = 70;            // chars of cap text shown in the human plan line

// The cap's prose lives in items_fts.body (the items table has no body column); join it in so the
// (type)/text/dedup parse sees the real cap text, not just the title.
function inboxCaps(db, scopeFilter) {
  return db.all(
    `SELECT i.id, i.scope, i.file, i.title, f.body
     FROM items i JOIN items_fts f ON f.id = i.id
     WHERE i.store = 'inbox'${scopeFilter ? ' AND i.scope = ?' : ''}
     ORDER BY i.scope, i.id`,
    scopeFilter ? [scopeFilter] : [],
  );
}

// Dedup candidates for a cap, confined to its target store — the same FTS OR-match q.mjs `similar`
// runs, but on the ALREADY-OPEN handle (no per-cap shell-out).
function dedupCandidates(db, store, needle) {
  if (!store) return [];
  return db.all(
    `SELECT i.id, i.title FROM items_fts f JOIN items i ON i.id = f.id
     WHERE items_fts MATCH ? AND i.store = ? AND i.archived = 0 AND i.status <> 'superseded'
     ORDER BY rank LIMIT ?`,
    [ftsOrQuery(needle), store, DEDUP_LIMIT],
  );
}

function planForCap(db, cap, configs) {
  const sc = configs.get(cap.scope);
  const classifications = sc ? sc.classifications : {};
  const type = leadingType(cap.body);
  const text = capText(cap.body);
  const known = type ? classifications[type] : null;
  const route = known ? known.route : null;
  const priority = known ? known.priority : null;
  const store = route ? ROUTE_STORE[route] : null;
  return {
    capId: cap.id,
    scope: cap.scope,
    file: cap.file,
    text,
    type: type || null,
    route,
    priority,
    needsClassification: !known,
    // A deterministic cap dedups against its resolved store; an ambiguous one has no single
    // target yet, so it probes the broadest store (tickets) to surface candidates for the LLM.
    dedupCandidates: dedupCandidates(db, store || PROBE_STORE, text),
    allowedClassifications: Object.keys(classifications),
  };
}

export async function plan({ scopeFilter, json, dbPath }) {
  const handle = await openHandle(dbPath);
  if (!handle) {
    process.stderr.write('triage: no SQLite engine — install better-sqlite3 or run on Node 22+.\n');
    process.exit(1);
  }
  try {
    const configs = new Map();
    for (const [scope, { aiDir, root }] of scopeIndex()) configs.set(scope, loadScope(aiDir, root));
    const caps = inboxCaps(handle, scopeFilter);
    const items = caps.map((c) => planForCap(handle, c, configs));
    const out = {
      generatedAt: new Date().toISOString(),
      // single-handle proof: every query above ran on the ONE handle openHandle() returned (KIT-D025).
      dbHandleOpens: 1,
      scopes: [...new Set(items.map((i) => i.scope))].sort(),
      counts: {
        total: items.length,
        deterministic: items.filter((i) => !i.needsClassification).length,
        needsClassification: items.filter((i) => i.needsClassification).length,
      },
      items,
    };
    if (json) process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    else printPlan(out);
    return out;
  } finally {
    handle.close();
  }
}

function printPlan(out) {
  process.stdout.write(
    `triage plan — ${out.counts.total} caps `
    + `(${out.counts.deterministic} deterministic, ${out.counts.needsClassification} need classification) `
    + `across ${out.scopes.length} scope(s)\n\n`,
  );
  const byScope = new Map();
  for (const i of out.items) {
    if (!byScope.has(i.scope)) byScope.set(i.scope, []);
    byScope.get(i.scope).push(i);
  }
  for (const [scope, items] of [...byScope].sort((a, b) => a[0].localeCompare(b[0]))) {
    process.stdout.write(`${scope} (${items.length})\n`);
    for (const i of items) {
      const tag = i.needsClassification ? '? CLASSIFY' : `→ ${i.type} → ${i.route} [${i.priority || '-'}]`;
      const dup = i.dedupCandidates.length ? `  dup? ${i.dedupCandidates.map((c) => c.id).join(', ')}` : '';
      const allow = i.needsClassification ? `  pick: ${i.allowedClassifications.join('|')}` : '';
      process.stdout.write(`  ${tag}  ${truncate(i.text, TEXT_COL)}${dup}${allow}\n`);
    }
    process.stdout.write('\n');
  }
}
