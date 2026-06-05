// triage/config.mjs — per-scope routing config for triage (KIT-T027). Minimal block-scoped
// parse of config.yml (no yaml dep, mirroring cap.mjs/id-utils): a classification's routes_to +
// priority, the statuses.flow head (the status a fresh item opens in), and drain.order. Cached
// per aiDir so a scope is read once across many caps.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readIdConfig } from '../id-utils.mjs';
import { hydrationSources } from '../hydrate-db.mjs';

// A route from config.classifications maps onto a physical store: `backlog` is a ticket without a
// milestone, `active-ticket` appends to the in-flight ticket (no new item). ONE place so plan and
// apply agree on where a classification lands.
export const ROUTE_STORE = {
  tickets: 'tickets',
  backlog: 'tickets',
  questions: 'questions',
  notes: 'notes',
  decisions: 'decisions',
};

const FIRST_FLOW_FALLBACK = 'todo';
const INDENT_TWO = /^\s{2}([A-Za-z][\w-]*):\s*\{([^}]*)\}/;

export function parseClassifications(text) {
  const out = {};
  let inBlock = false;
  for (const line of text.split('\n')) {
    if (/^classifications:\s*$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break; // next top-level key ends the block
    const m = line.match(INDENT_TWO);
    if (!m) continue;
    const route = (m[2].match(/routes_to:\s*([\w-]+)/) || [])[1] || null;
    const priority = (m[2].match(/priority:\s*([\w-]+)/) || [])[1] || null;
    out[m[1]] = { route, priority };
  }
  return out;
}

function parseFlowHead(text) {
  const m = text.match(/^\s*flow:\s*\[([^\]]*)\]/m);
  if (!m) return FIRST_FLOW_FALLBACK;
  return m[1].split(',')[0].trim() || FIRST_FLOW_FALLBACK;
}

function parseDrainOrder(text) {
  const m = text.match(/^\s*order:\s*\[([^\]]*)\]/m);
  return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
}

const cache = new Map();

export function loadScope(aiDir, root) {
  if (cache.has(aiDir)) return cache.get(aiDir);
  let cfg = { classifications: {}, flowHead: FIRST_FLOW_FALLBACK, drainOrder: [], aiDir, root };
  try {
    const text = readFileSync(join(aiDir, 'config.yml'), 'utf8');
    cfg = {
      classifications: parseClassifications(text),
      flowHead: parseFlowHead(text),
      drainOrder: parseDrainOrder(text),
      aiDir,
      root,
    };
  } catch { /* a scope with no config is all-ambiguous */ }
  cache.set(aiDir, cfg);
  return cfg;
}

// Every present scope (key -> { aiDir, root }) via the same hydration sources the cache was
// built from, so config lookup tracks the cache's scope set exactly.
export function scopeIndex() {
  const byKey = new Map();
  for (const s of hydrationSources(undefined)) {
    const { key } = readIdConfig(s.root, s.aiDir);
    if (key) byKey.set(key, { aiDir: s.aiDir, root: s.root });
  }
  return byKey;
}
