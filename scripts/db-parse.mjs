// db-parse.mjs — turn the .ai markdown stores into the cache's row model (KIT-T004).
//
// Markdown is TRUTH; this is a one-way read. Reuses id-utils' scanStores/readIdConfig so
// the cache sees exactly the items the rest of the tooling does (same SKIP set, same
// archive handling, same id resolution). Everything below is pure parse — no SQLite here,
// so it is also the data source for the markdown-scan fallback when no engine exists.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanStores, readIdConfig, STORE_TYPE } from './id-utils.mjs';

function frontmatterBlock(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// A YAML-ish inline list (`links: [A, B]`) OR an empty/absent field -> string[]. Also
// tolerates a single bare scalar (`parent: KIT-T003`) by returning [value].
function list(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return [];
  const raw = m[1].trim();
  if (!raw) return [];
  const inner = raw.replace(/^\[|\]$/g, '');
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

const SCOPE_FROM_ID = (id) => (String(id).match(/^([A-Za-z]+)-/) || [])[1] || '';
const NUM_FROM_ID = (id) => {
  const m = String(id).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

// Body wikilinks: [[KIT-D012]] -> see-also edges the frontmatter `links:` may not list.
function wikilinks(body) {
  return [...body.matchAll(/\[\[([A-Za-z]+-[A-Za-z]?\d+)\]\]/g)].map((m) => m[1]);
}

// History events: the config vocab is "- [YYYY-MM-DD HH:MM] (event) detail" under a
// `## History` heading, but dated bullets also accrue under `## Notes`. Parse both so the
// activity rollup (borrowed from workflow's activity.service) has events to aggregate.
function historyEvents(body) {
  const events = [];
  const re = /^[-*]\s*\[(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2})?)\]\s*(?:\(([a-z]+)\)\s*)?(.*)$/gim;
  let m;
  while ((m = re.exec(body)) !== null) {
    events.push({ ts: m[1].replace(' ', 'T'), event: m[2] || 'note', detail: m[3].trim() });
  }
  return events;
}

// Everything the cache needs from one store file, store/source agnostic.
export function parseItem(absPath, store) {
  const text = readFileSync(absPath, 'utf8');
  const fm = frontmatterBlock(text);
  const body = text.slice(fm ? text.indexOf('\n---', 3) + 4 : 0);
  const id = scalar(fm, 'id');
  const links = new Set(list(fm, 'links'));
  for (const w of wikilinks(body)) links.add(w);
  return {
    id,
    type: scalar(fm, 'type') || STORE_TYPE[store] || store,
    status: scalar(fm, 'status'),
    priority: scalar(fm, 'priority'),
    title: scalar(fm, 'title'),
    parent: scalar(fm, 'parent'),
    milestone: scalar(fm, 'milestone'),
    aka: list(fm, 'aka'),
    links: [...links],
    // provenance edges (KIT-D012) — present once those fields land; harmless when absent
    regressedFrom: scalar(fm, 'regressed_from') || scalar(fm, 'regression_of'),
    introducedBy: scalar(fm, 'introduced_by'),
    causingCommit: scalar(fm, 'causing_commit'),
    fixedCommit: scalar(fm, 'fixed_commit'),
    producedBy: scalar(fm, 'produced_by'),
    informs: list(fm, 'informs'),
    history: historyEvents(body),
    body: body.trim(),
  };
}

// The full dataset the hydrator (and the markdown-scan fallback) consume: every item
// across every store under one kit/data root, with scope+num split out for next-id.
// `aiDir` overrides the <root>/.ai derivation so a central-data store (where the notebook
// dir IS the .ai dir) hydrates directly — the basis for cross-scope hydration (KIT-T031).
export function collectItems(root, aiDir = join(root, '.ai')) {
  const { key } = readIdConfig(root, aiDir);
  const ai = aiDir;
  const items = [];
  for (const it of scanStores(root, aiDir)) {
    const abs = join(ai, it.sub, it.file);
    const parsed = parseItem(abs, it.store);
    const id = parsed.id || it.id;
    items.push({
      ...parsed,
      id,
      store: it.store,
      scope: SCOPE_FROM_ID(id) || key || '',
      num: NUM_FROM_ID(id),
      file: `${it.sub}/${it.file}`,
      archived: it.sub.includes('archive') ? 1 : 0,
    });
  }
  return items;
}
