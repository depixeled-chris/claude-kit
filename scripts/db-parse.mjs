// db-parse.mjs — turn the .ai markdown stores into the cache's row model (KIT-T004).
//
// Markdown is TRUTH; this is a one-way read. Reuses id-utils' scanStores/readIdConfig so
// the cache sees exactly the items the rest of the tooling does (same SKIP set, same
// archive handling, same id resolution). Everything below is pure parse — no SQLite here,
// so it is also the data source for the markdown-scan fallback when no engine exists.

import { readFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { scanStores, readIdConfig, STORE_TYPE } from './id-utils.mjs';

// A process-wide tally of store-file CONTENT reads, so a test can prove the incremental sync
// reads ZERO file bodies when nothing changed (KIT-T026: efficiency is the point — an
// unchanged file is never opened). Stat-only enumeration does not touch this. Reset/read via
// readCount(); every body read in this module goes through readBody().
let _readCount = 0;
export function readCount() {
  return _readCount;
}
export function resetReadCount() {
  _readCount = 0;
}
function readBody(absPath) {
  _readCount++;
  return readFileSync(absPath, 'utf8');
}

function frontmatterBlock(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

// Drop a trailing YAML line-comment (` # …`) the stores routinely add to template fields
// (`files: []   # repo-root-relative paths`). A `#` INSIDE `[...]` or a quote is kept (it may
// be a real value char); only a `#` at top level — preceded by whitespace or starting the value
// — is a comment. Without this, `files: [] # note` parsed the comment text as a bogus entry,
// which surfaced as junk drift/governing targets (KIT-T049).
function stripComment(raw) {
  let depth = 0;
  let quote = '';
  for (let k = 0; k < raw.length; k++) {
    const c = raw[k];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (c === '#' && depth === 0 && (k === 0 || /\s/.test(raw[k - 1]))) return raw.slice(0, k);
  }
  return raw;
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? stripComment(m[1]).trim().replace(/^["']|["']$/g, '') : '';
}

// A YAML-ish inline list (`links: [A, B]`) OR an empty/absent field -> string[]. Also
// tolerates a single bare scalar (`parent: KIT-T003`) by returning [value].
function list(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return [];
  const raw = stripComment(m[1]).trim();
  if (!raw) return [];
  const inner = raw.replace(/^\[|\]$/g, '');
  return inner
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

// A comma-separated scalar field (`paths: rust/*, src/world/*`) -> string[]. Unlike list(),
// this expects bare commas (no `[...]` wrapper) — the form decisions write `paths` in, mirrored
// from orient's standing-decision filter. Tolerates a `[...]`-wrapped value too (strips it).
function csv(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return [];
  return stripComment(m[1]).trim().replace(/^\[|\]$/g, '')
    .split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

const SCOPE_FROM_ID = (id) => (String(id).match(/^([A-Za-z]+)-/) || [])[1] || '';
const NUM_FROM_ID = (id) => {
  const m = String(id).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
};

// A STABLE synthetic id for an id-less store file (inbox caps written as `(type) text`, or any
// file lacking frontmatter `id:`). Keyed on scope + store + the filename stem, so it is
// deterministic (same file → same id across hydrations) and collision-safe within a scope (one
// file → one id). Shape `<SCOPE>-<STORE>-<stem>` reads in a cross-store query and never
// collides with a real <SCOPE>-<TYPE><NUM> id (no trailing-number-only form; the store segment
// is a word, not a single type letter). NUM_FROM_ID returns null for these (no counter), so
// they never perturb next-id allocation.
function synthId(scope, store, file) {
  const stem = basename(file, extname(file));
  return `${scope}-${store.toUpperCase()}-${stem}`;
}

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

// A leading "(type) rest" tag on an id-less cap (cap.mjs writes `(bug) login loops`). Returns
// the bare type word when present, else ''. Only the FIRST line is considered, so a "(foo)" in
// the body never masquerades as a type.
function leadingType(body) {
  const m = body.trimStart().match(/^\(([a-z][\w-]*)\)/i);
  return m ? m[1] : '';
}

// Everything the cache needs from one store file, store/source agnostic. For an id-less file
// (an inbox cap, or any store file without frontmatter `id:`) the returned `id` is '' — the
// CALLER (collectItems) synthesizes a stable id from scope+store+filename, since that is
// where the scope key is known. `type` falls back to a leading "(type)" tag on the body.
export function parseItem(absPath, store) {
  const text = readBody(absPath);
  const fm = frontmatterBlock(text);
  const body = text.slice(fm ? text.indexOf('\n---', 3) + 4 : 0);
  const id = scalar(fm, 'id');
  const links = new Set(list(fm, 'links'));
  for (const w of wikilinks(body)) links.add(w);
  return {
    id,
    type: scalar(fm, 'type') || leadingType(body) || STORE_TYPE[store] || store,
    status: scalar(fm, 'status'),
    priority: scalar(fm, 'priority'),
    title: scalar(fm, 'title'),
    parent: scalar(fm, 'parent'),
    milestone: scalar(fm, 'milestone'),
    labels: list(fm, 'labels'),
    files: list(fm, 'files'),
    // governance scope (KIT-T049): a decision declares the files it governs via `scope`
    // (a free token) and/or `paths` (comma globs) — the same fields orient's standing-decision
    // filter reads. Named `govScope` (NOT `scope`) because the cache row's `scope` is the ID
    // prefix (GOV from GOV-D001), set by rowFromScan — reusing the key would clobber this.
    // `paths` is comma-separated (NOT a YAML list), so split on comma, not list().
    govScope: scalar(fm, 'scope'),
    paths: csv(fm, 'paths'),
    aka: list(fm, 'aka'),
    // supersede edges (KIT-T024): a newer ticket retires an older one. `supersedes` is the
    // outbound pointer (newer -> older); `superseded_by` the back-pointer (older -> newer).
    // Mirrors decisions' `supersedes:`. A ticket carrying either is out of the active set.
    supersedes: scalar(fm, 'supersedes'),
    supersededBy: scalar(fm, 'superseded_by'),
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

// Parse ONE store file into a full cache row, given the scan entry (sub/file/store) and the
// scope-key fallback. Factored out so the incremental sync (hydrate-db) can re-parse exactly
// one dirty file with the IDENTICAL row shape collectItems produces for a full pass — same
// id resolution, scope/num split, synthetic-id fallback, and archive flag. `key` is the
// project's ids.key (readIdConfig), used only when an id carries no scope prefix.
export function rowFromScan(aiDir, it, key) {
  const abs = join(aiDir, it.sub, it.file);
  const parsed = parseItem(abs, it.store);
  // id precedence: frontmatter id → filename id → a STABLE synthetic id for an id-less file
  // (inbox caps, questions, any frontmatter-less store file), so it is still indexed (KIT-T026).
  const realId = parsed.id || it.id;
  const id = realId || synthId(key || 'X', it.store, it.file);
  return {
    ...parsed,
    id,
    store: it.store,
    scope: SCOPE_FROM_ID(id) || key || '',
    num: NUM_FROM_ID(id),
    file: `${it.sub}/${it.file}`,
    archived: it.sub.includes('archive') ? 1 : 0,
  };
}

// The full dataset the hydrator (and the markdown-scan fallback) consume: every item
// across every store under one kit/data root, with scope+num split out for next-id.
// `aiDir` overrides the <root>/.ai derivation so a central-data store (where the notebook
// dir IS the .ai dir) hydrates directly — the basis for cross-scope hydration (KIT-T031).
export function collectItems(root, aiDir = join(root, '.ai')) {
  const { key } = readIdConfig(root, aiDir);
  return scanStores(root, aiDir).map((it) => rowFromScan(aiDir, it, key));
}
