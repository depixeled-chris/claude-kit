#!/usr/bin/env node
// q.mjs — the query interface over the KIT-T004 cache (the agent-retrieval layer: QUERY
// the cache, don't open files). Canned graph/FTS queries + ad-hoc SQL, compact output.
//
//   node scripts/q.mjs open [scope]                 # open items (todo|doing|review)
//   node scripts/q.mjs children <id>                # items whose parent is <id>
//   node scripts/q.mjs backlinks <id>               # items that link TO <id> (any rel) — walk DOWN
//   node scripts/q.mjs trail <id>                   # walk UP <id>'s ancestry → governing decisions/docs/origin (trail-on-action)
//   node scripts/q.mjs governing <path...>          # OPEN tickets/decisions that GOVERN the given file path(s) (the inverse of trail)
//   node scripts/q.mjs drift                        # OPEN items naming a structural target path ABSENT from the tree (decided ≠ actual)
//   node scripts/q.mjs by-commit <sha>              # tickets caused-by / fixed-by <sha>
//   node scripts/q.mjs doc-trail <id>               # history events for <id>, newest first
//   node scripts/q.mjs fts <query...>               # full-text search title+body
//   node scripts/q.mjs similar <title/labels...>    # likely-duplicate ITEMS (dedup, suggest-only)
//   node scripts/q.mjs similar --store <s> <text>   # …confined to one store (tickets|decisions|notes|questions)
//   node scripts/q.mjs next-id <scope> <type>       # O(1) next free id (max(num)+1)
//   node scripts/q.mjs rundown                       # per-scope open-item counts
//   node scripts/q.mjs regressions                   # regression chain data (index-tickets)
//   node scripts/q.mjs supersedes                    # supersede chain data (index-tickets)
//   node scripts/q.mjs integrity                     # orphan parents / dangling links / gaps
//   node scripts/q.mjs sql "SELECT ..."             # ad-hoc read-only SQL
//   node scripts/q.mjs --json <cmd> ...             # machine-readable output
//
// QUERY PATTERNS borrowed from the workflow repo's services + ADAPTED:
//   * `open` mirrors assignments/blockers.service getX(params) — a WHERE-filtered list.
//   * `children`/`backlinks` mirror comments.service's parentId tree walk, generalized to
//     the links graph (upward-stored parent, downward-generated view — KIT-D012).
//   * `doc-trail` mirrors activity.service's per-task timeline (sorted desc).
//   * `next-id`/`integrity` realize KIT-T009's markdown-served logic as O(1) SQL.
//
// FALLBACK: with no DB (or no SQLite engine), every canned query degrades to an in-memory
// markdown scan via db-parse, so an agent/hook still gets answers — the cache is optional.

import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveEngine } from './db-engine.mjs';
import { collectItems } from './db-parse.mjs';
import { hydrate, defaultDbPath, hydrationSources } from './hydrate-db.mjs';
import { readIdConfig, STORE_TYPE, compareIds } from './id-utils.mjs';

const OPEN = ['todo', 'doing', 'review'];
const FTS_LIMIT = 25;        // cap FTS hits — a retrieval list, not a full dump
const MIN_TERM_LEN = 2;      // dedup: ignore terms this short or shorter (the, of, a, id)
const SNIPPET_COL = 2;       // items_fts column index of `body` for snippet()
const SNIPPET_TOKENS = 8;    // words of context around an FTS match

// Dedup similarity proxy (KIT-T024): turn a proposed title/labels into an FTS OR-query so a
// candidate matches on ANY shared term (a duplicate rarely shares EVERY word). Extracts plain
// barewords (no FTS MATCH syntax injected) and ORs the survivors. Empty in -> a query that
// matches nothing, so a blank proposal surfaces no false candidates.
const ALNUM_TERM = /[a-z][a-z\d]*/g; // a bareword: leading letter, then letters/digits
function ftsOrQuery(text) {
  const terms = (String(text || '').toLowerCase().match(ALNUM_TERM) || [])
    .filter((t) => t.length > MIN_TERM_LEN);
  return terms.length ? terms.join(' OR ') : '""';
}

// Dedup is now cross-store (KIT-T025): a proposed item can duplicate one in ANY store, so
// `similar` confines candidates to the store you are creating into. Both the cache and the
// markdown-scan paths split a leading `--store <s>` off the free-text proposal here, so the
// store filter is parsed in ONE place. Default `tickets` keeps KIT-T024 callers unchanged.
function parseSimilar(text) {
  const m = String(text || '').match(/^\s*--store\s+(\S+)\s*([\s\S]*)$/);
  return { store: m ? m[1] : 'tickets', query: (m ? m[2] : text).trim() };
}

function newestAcross(sources) {
  let newest = 0;
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.md')) newest = Math.max(newest, statSync(p).mtimeMs);
    }
  };
  for (const s of sources) walk(s.aiDir);
  return newest;
}

// Open the cache, auto-(re)hydrating when it is missing or stale. `root` is undefined for a
// cross-scope query (all registered scopes) and set only when --root forces single-scope;
// staleness is checked against exactly the sources that will be hydrated (KIT-T031). Returns
// a db handle, or null when no SQLite engine exists (caller then uses the markdown fallback).
async function db(root, dbPath) {
  const open = await resolveEngine();
  if (!open) return null;
  const stale = !existsSync(dbPath) || statSync(dbPath).mtimeMs < newestAcross(hydrationSources(root));
  if (stale) await hydrate({ root, dbPath });
  return open(dbPath);
}

function storeForType(type) {
  // type may be a store name (tickets) or a type letter/word; map to a store bucket.
  if (STORE_TYPE[type]) return type;
  const byLetter = Object.entries(STORE_TYPE).find(([, l]) => l === type);
  return byLetter ? byLetter[0] : 'tickets';
}

function formatId(root, scope, type, num) {
  const { pad } = readIdConfig(root);
  const letter = STORE_TYPE[type] || type;
  return `${scope}-${letter}${String(num).padStart(pad, '0')}`;
}

// Open-item ordering — ONE comparator both the cache and the markdown-scan paths sort by,
// so the two are byte-identical (KIT-T026 parity). Priority first (BINARY/code-point order,
// matching SQLite's default collation), then id NUMERICALLY via compareIds (so KIT-T1000
// follows KIT-T999 — which a plain text ORDER BY in SQL gets backwards). Applying it in JS
// on both sides is what removes SQL-text-vs-compareIds as a parity gap.
const compareOpen = (a, b) =>
  ((a.priority || '') < (b.priority || '') ? -1 : (a.priority || '') > (b.priority || '') ? 1 : 0)
  || compareIds(a.id, b.id);

// A ticket retired by another (KIT-T024): a `superseded` status, or a `superseded_by` pointer
// to its replacement. Either takes it out of the active/drain set. ONE predicate so the cache
// SQL (the open WHERE) and the markdown-scan fallback agree on what "active" means.
const isSuperseded = (i) => i.status === 'superseded' || !!i.supersededBy;

// An item's outbound edges, mirroring the hydrate edge-set (links/parent/regressed_from/
// introduced_by/caused_by/fixed_by) so the markdown-scan graph queries match the cache.
const edgesOf = (i) => [
  ...i.links.map((t) => ['link', t]),
  i.parent ? ['parent', i.parent] : null,
  i.regressedFrom ? ['regressed_from', i.regressedFrom] : null,
  i.introducedBy ? ['introduced_by', i.introducedBy] : null,
  i.causingCommit ? ['caused_by', i.causingCommit] : null,
  i.fixedCommit ? ['fixed_by', i.fixedCommit] : null,
  i.supersedes ? ['supersedes', i.supersedes] : null,
  i.supersededBy ? ['superseded_by', i.supersededBy] : null,
].filter(Boolean);

// ANTECEDENT edges — the "inception-out" pointers an item records to where it CAME FROM
// (parent epic, the decisions/docs/tickets that informed it, the thing it supersedes or
// regressed from). The family-tree rule: a descendant points UP to its ancestors; we walk
// these to paint the complete picture for an item before acting on it. `superseded_by` and
// `fixed_by` are DESCENDANT/forward pointers — excluded from the upward walk.
const ANCESTOR_RELS = new Set(['link', 'parent', 'supersedes', 'regressed_from', 'introduced_by', 'caused_by']);

// Store display order for a trail SUMMARY: governing DECISIONS first, then research/design
// DOCS, then the rest. Lower rank = surfaced first (the trail-on-action rule).
const STORE_RANK = { decisions: 0, research: 1, docs: 1, requests: 2, questions: 3, tickets: 4, notes: 5 };
const storeRank = (s) => (s in STORE_RANK ? STORE_RANK[s] : 9);

// A trail edge target must be an ITEM id (SCOPE-Letter###) or a commit sha — not the prose
// some legacy `supersedes:`/`source:` fields carry (e.g. "reframes HOD-T009…"). Guarding the
// walk here keeps the trail clean regardless of messy frontmatter; the data smell is flagged
// separately, not papered over.
const ID_SHAPE = /^[A-Za-z]+-[A-Za-z]?\d+$/;
const SHA_SHAPE = /^[0-9a-f]{7,40}$/i;
const isTrailTarget = (t) => ID_SHAPE.test(t) || SHA_SHAPE.test(t);

// Walk an item's ancestry breadth-first along ANTECEDENT_RELS, returning each reached
// ancestor once (nearest depth wins) with the rel + depth it was reached by. `getEdges(id)`
// yields outbound [rel,to] pairs; `getNode(id)` yields the item record (or undefined for a
// dangling ref / a commit sha). Pure graph walk — same logic for the cache + markdown paths.
const SUMMARY_CLIP = 80; // chars of the one-line gist a trail shows — a CLUE, not the full record
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function walkAncestry(startId, getEdges, getNode) {
  const seen = new Set([startId]);
  const out = [];
  let frontier = [[startId, 0]];
  while (frontier.length) {
    const next = [];
    for (const [id, depth] of frontier) {
      for (const [rel, to] of getEdges(id)) {
        if (!ANCESTOR_RELS.has(rel) || seen.has(to) || !isTrailTarget(to)) continue;
        seen.add(to);
        const node = getNode(to);
        const isCommit = /^[0-9a-f]{7,40}$/i.test(to);
        // Token-frugal: show the node's `summary` (or a clipped title) — the GIST — plus a
        // `more` clue (✎ = there's a fuller body to drill into). The agent opens a node's
        // full text only when the summary says it needs it (KIT-D028 trail-on-action).
        const gist = node ? (node.summary || node.title || '') : (isCommit ? '(commit)' : '(not in cache: ' + to + ')');
        const bodyLen = node ? (node.bodyLen ?? (node.body ? node.body.length : 0)) : 0;
        const summaryWasClipped = node && !node.summary && String(node.title || '').length > SUMMARY_CLIP;
        out.push({
          id: to,
          store: node ? node.store : (isCommit ? 'commit' : 'missing'),
          rel,
          depth: depth + 1,
          summary: clip(gist, SUMMARY_CLIP),
          more: bodyLen > 0 || summaryWasClipped ? '✎' : '',
        });
        next.push([to, depth + 1]);
      }
    }
    frontier = next;
  }
  // Decisions + docs first (the context the agent must see before acting), then by depth/id.
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || a.depth - b.depth || compareIds(a.id, b.id));
}

// ---- file-scoped governance (KIT-T049) ------------------------------------
// The OTHER direction from `trail` (which walks an item's ANCESTRY up): given file path(s),
// which OPEN tickets/decisions GOVERN them. A ticket governs via its `files:` frontmatter; a
// decision via `scope`/`paths`. The motivating failure: HOD-T048 (files: src/sim, src/main.ts)
// sat `todo` while those exact files were worked and nothing surfaced it.

// POSIX-normalize a path for matching so a Windows-style edit path lines up with the
// forward-slash globs the stores write, and a leading ./ never blocks a match.
const normPath = (p) => String(p || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');

// A glob (orient's globToRe shape: `*` -> `.*`, everything else literal, case-insensitive,
// anchored). `src/world/*` matches `src/world/City.ts`; `rust/*` matches `rust/anything`.
const globToRe = (g) => new RegExp(
  '^' + normPath(g).split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');

// Does a governing PATTERN (a ticket `files:` entry or a decision `paths:` glob) cover a
// queried FILE path? Three ways, widest-first: (a) glob match when the pattern has a `*`;
// (b) exact path equality; (c) directory containment either way — a `files: src/sim` entry
// governs an edit to `src/sim/Foo.ts` (pattern is an ancestor dir of the file), AND a query
// for the directory `src/world` surfaces a decision whose glob/path is UNDER it. Both
// normalized to POSIX so OS path separators never split a real match.
function pathCovered(pattern, file) {
  const pat = normPath(pattern);
  const f = normPath(file);
  if (!pat || !f) return false;
  if (pat.includes('*')) return globToRe(pat).test(f) || globToRe(pat).test(f.split('/')[0] + '/x');
  if (pat === f) return true;
  return f.startsWith(pat + '/') || pat.startsWith(f + '/');
}

// The governing patterns an item exposes: a ticket's `files:` entries, a decision's `paths:`
// globs. (`scope` is a free token, matched against the query string separately by the caller —
// it is not a path.) Returns [] for an item that governs nothing.
const governPatterns = (i) => [...(i.files || []), ...(i.paths || [])];

// "In force" for governance/drift — store-aware, because a DECISION has no flow status: it
// governs from the moment it's recorded until it's SUPERSEDED (the anti-relitigation backbone),
// so requiring todo/doing/review would wrongly drop every decision. A TICKET, by contrast, only
// governs while it's still OPEN (a `done` ticket's reorg is already executed — not pending).
// Both exclude archived + superseded.
const isInForce = (i) =>
  !i.archived && !isSuperseded(i) &&
  (i.store === 'decisions' ? i.status !== 'rejected' : OPEN.includes(i.status));

// One row of `governing` output — DECISIONS-first, token-frugal gist + `✎` drill-in clue,
// PLUS which of the item's patterns matched (the agent sees WHY it surfaced, in 1 line).
function governingRow(i, hits) {
  const bodyLen = i.body ? i.body.length : 0;
  const titleClipped = String(i.title || '').length > SUMMARY_CLIP;
  return {
    id: i.id,
    store: i.store,
    status: i.status,
    matched: [...new Set(hits)].join(','),
    summary: clip(i.summary || i.title || '', SUMMARY_CLIP),
    more: bodyLen > 0 || titleClipped ? '✎' : '',
  };
}

// `governing <path...>`: the OPEN tickets/decisions governing the given file path(s). Runs on
// the markdown scan (collectItems) — `files:`/`scope`/`paths` are not in the SQLite schema, so
// the scan IS the fail-open source either way (the cache is never a hard dependency, KIT-T031).
function governing(items, paths) {
  const queried = paths.map(normPath).filter(Boolean);
  const out = [];
  for (const i of items) {
    if (!isInForce(i)) continue;
    const hits = [];
    for (const pat of governPatterns(i)) {
      for (const q of queried) if (pathCovered(pat, q)) { hits.push(pat); break; }
    }
    // A decision's `scope` token (govScope — NOT the id-prefix scope) governs when it appears
    // literally in a queried path: keeps the free-token contract without baking a taxonomy in.
    if (i.govScope && queried.some((q) => q.toLowerCase().includes(i.govScope.toLowerCase()))) hits.push('scope:' + i.govScope);
    if (hits.length) out.push(governingRow(i, hits));
  }
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || compareIds(a.id, b.id));
}

// `drift`: decided-vs-actual STRUCTURAL drift. For each OPEN item, flag a governing target
// the tree doesn't actually have — a reorg that was DECIDED but never EXECUTED. Two honest
// signals, no NLP:
//   (1) DECLARED targets absent — its `files:` entries that name a CONCRETE path absent from
//       disk. (Decision `paths:` GLOBS are deliberately NOT drift targets: a glob like
//       `rust/*` is a forward-looking governance SCOPE, not a "this folder must exist" claim,
//       so an absent `rust/` is normal, not drift.)
//   (2) UNREALIZED SEPARATION — an item whose body declares a "retire X as the truth / keep it
//       frozen as the example" reorg while NO frozen/legacy destination dir exists anywhere in
//       the tree. This is the HOD-T048 case — the exact failure that motivated KIT-T049.
//       Reported target: the missing dir(s).
// `exists(path)` is injected so the cache, CLI, and test paths share one tree-probe.
// Candidate destination dirs a "retire X as truth / keep it frozen as the example" reorg
// implies. Probed against the tree (and src/-prefixed) so a project that DID make the
// separation clears the flag the moment any of them exists. Tiny + literal on purpose.
const SEPARATION_DIRS = ['legacy', 'frozen', 'src/legacy', 'src/frozen'];
// A DELIBERATE retire-a-product-subsystem-to-a-frozen-area declaration — NOT any incidental
// "freeze input" / "legacy enum" mention. The signal is a retire/freeze/legacy verb sitting
// CLOSE TO a source-of-truth/product noun (the thing being demoted): "retire TS-as-truth",
// "TS sim … retired as the product's truth", "kept frozen as the gta7 example", "the TS SIM is
// legacy". Proximity (~40 chars) is what separates this reorg intent from a stray keyword.
const SEPARATION_RE =
  /\b(retir\w+|frozen|freeze|legacy|deprecat\w+)\b[^.\n]{0,40}?\b(as[ -](?:the[ ]+)?(?:truth|product|oracle|example)|truth|product[ ]+(?:sim|path|truth)|example|oracle)\b/i;
function declaresSeparation(body) {
  return SEPARATION_RE.test(String(body || ''));
}
function drift(items, exists) {
  const out = [];
  const haveSeparationArea = SEPARATION_DIRS.some((d) => exists(d));
  for (const i of items) {
    if (!isInForce(i)) continue;
    const targets = new Set();
    for (const f of (i.files || [])) { const t = normPath(f); if (t && !t.includes('*')) targets.add(t); }
    const absent = [...targets].filter((t) => !exists(t));
    let reason = absent.length ? 'declared-target-absent' : '';
    if (!haveSeparationArea && declaresSeparation(i.body)) {
      for (const d of SEPARATION_DIRS) absent.push(d);
      reason = reason ? reason + '+unrealized-separation' : 'unrealized-separation';
    }
    if (absent.length) {
      out.push({
        id: i.id, store: i.store, status: i.status, reason,
        absent: [...new Set(absent)].sort().join(','),
        summary: clip(i.summary || i.title || '', SUMMARY_CLIP),
        more: i.body && i.body.length ? '✎' : '',
      });
    }
  }
  return out.sort((a, b) => storeRank(a.store) - storeRank(b.store) || compareIds(a.id, b.id));
}

// ---- SQLite-backed canned queries -----------------------------------------
function cannedQueries(root) {
  return {
    // The active/drain set EXCLUDES superseded tickets (KIT-T024): a `superseded` status OR
    // any non-archived ticket carrying a `superseded_by` pointer is out — so a forgotten
    // status flip can't leak a retired duplicate back into the drain.
    open: (db, scope) => db.all(
      `SELECT i.id, i.type, i.status, i.priority, i.title FROM items i
       WHERE i.status IN (${OPEN.map(() => '?').join(',')}) AND i.archived = 0
         AND i.status <> 'superseded'
         AND NOT EXISTS (SELECT 1 FROM links l WHERE l.from_id = i.id AND l.rel = 'superseded_by')
         ${scope ? 'AND i.scope = ?' : ''}`,
      scope ? [...OPEN, scope] : [...OPEN]).sort(compareOpen),

    children: (db, id) => db.all(
      'SELECT id, type, status, title FROM items WHERE parent = ? ORDER BY id', [id]),

    backlinks: (db, id) => db.all(
      `SELECT i.id, i.type, i.status, l.rel, i.title
       FROM links l JOIN items i ON i.id = l.from_id
       WHERE l.to_id = ? ORDER BY l.rel, i.id`, [id]),

    // Commit→ticket cross-ref (KIT-T026): the indexed idx_links_to lookup over the
    // caused_by/fixed_by edges — "which ticket did commit X introduce / which fixed Y".
    'by-commit': (db, sha) => db.all(
      `SELECT i.id, i.type, i.status, l.rel, i.title
       FROM links l JOIN items i ON i.id = l.from_id
       WHERE l.to_id = ? AND l.rel IN ('caused_by','fixed_by') ORDER BY l.rel, i.id`, [sha]),

    'doc-trail': (db, id) => db.all(
      'SELECT ts, event, detail FROM history WHERE item_id = ? ORDER BY ts DESC', [id]),

    fts: (db, query) => db.all(
      `SELECT f.id, i.type, i.status, i.title, snippet(items_fts, ?, '[', ']', '…', ?) AS hit
       FROM items_fts f JOIN items i ON i.id = f.id
       WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`, [SNIPPET_COL, SNIPPET_TOKENS, query, FTS_LIMIT]),

    rundown: (db) => db.all(
      `SELECT scope,
              SUM(status IN ('todo','doing','review')) AS open,
              SUM(status='doing') AS doing,
              SUM(status='review') AS review
       FROM items WHERE archived = 0 GROUP BY scope ORDER BY scope`),

    // Regression chain data for index-tickets (KIT-T026): every ticket with its upward
    // regressed_from + caused_by/fixed_by commit refs, pulled from the links edges. The
    // indexer assembles the chains; this just serves the per-id provenance from the cache.
    regressions: (db) => db.all(
      `SELECT i.id, i.title,
              rf.to_id AS regressed_from, cb.to_id AS causing_commit, fb.to_id AS fixed_commit
       FROM items i
       LEFT JOIN links rf ON rf.from_id = i.id AND rf.rel = 'regressed_from'
       LEFT JOIN links cb ON cb.from_id = i.id AND cb.rel = 'caused_by'
       LEFT JOIN links fb ON fb.from_id = i.id AND fb.rel = 'fixed_by'
       WHERE i.store = 'tickets' ORDER BY i.id`),

    // Supersede chain data for index-tickets (KIT-T024): every ticket's outbound supersedes
    // pointer (newer -> the older one it retires). index-tickets assembles older→newer chains
    // from these the same way it builds regression chains from regressed_from.
    supersedes: (db) => db.all(
      `SELECT i.id, i.status, i.title, s.to_id AS supersedes
       FROM items i
       LEFT JOIN links s ON s.from_id = i.id AND s.rel = 'supersedes'
       WHERE i.store = 'tickets' ORDER BY i.id`),

    // Dedup detector (KIT-T024, generalized to all stores in KIT-T025): FTS-rank likely
    // duplicates of a free-text proposal, confined to the target store. SUGGEST-ONLY —
    // returns candidates for the operator to link or supersede; never auto-merges. Excludes
    // already-superseded items. Shape matches the markdown-scan fallback (id/type/status/title)
    // so the two are at parity — a dedup hint needs the candidate's id + title, not a snippet.
    similar: (db, raw) => {
      const { store, query } = parseSimilar(raw);
      return db.all(
        `SELECT i.id, i.type, i.status, i.title
         FROM items_fts f JOIN items i ON i.id = f.id
         WHERE items_fts MATCH ? AND i.store = ? AND i.archived = 0
           AND i.status <> 'superseded'
         ORDER BY rank LIMIT ?`, [ftsOrQuery(query), store, FTS_LIMIT]);
    },

    // TRAIL (the trail-on-action rule): walk UP an item's ancestry — parent epic, the
    // decisions/docs/tickets it linked OUT to at inception — and summarize, decisions+docs
    // first. The up-walk surfaces the governing CONTEXT an agent needs before acting; the
    // down-walk (descendants) is `backlinks`/`children`. Load the graph once, walk in JS so
    // the cache + markdown paths share `walkAncestry`.
    trail: (db, id) => {
      const items = db.all('SELECT id, store, type, status, title FROM items');
      const links = db.all('SELECT from_id, rel, to_id FROM links');
      const nodeById = new Map(items.map((i) => [i.id, i]));
      const edgesById = new Map();
      for (const l of links) {
        if (!edgesById.has(l.from_id)) edgesById.set(l.from_id, []);
        edgesById.get(l.from_id).push([l.rel, l.to_id]);
      }
      return walkAncestry(id, (x) => edgesById.get(x) || [], (x) => nodeById.get(x));
    },

    'next-id': (db, scope, type) => {
      const row = db.all(
        'SELECT MAX(num) AS m FROM items WHERE scope = ? AND store = ?', [scope, storeForType(type)])[0];
      const next = (row && row.m ? row.m : 0) + 1;
      return [{ id: formatId(root, scope, type, next), scope, type, num: next }];
    },

    integrity: (db) => {
      const orphanParents = db.all(
        `SELECT i.id, i.parent FROM items i
         WHERE i.parent IS NOT NULL AND i.parent <> ''
           AND NOT EXISTS (SELECT 1 FROM items p WHERE p.id = i.parent)`);
      const danglingLinks = db.all(
        `SELECT DISTINCT l.from_id, l.rel, l.to_id FROM links l
         WHERE NOT EXISTS (SELECT 1 FROM items i WHERE i.id = l.to_id)
           AND l.to_id LIKE '%-%' ORDER BY l.from_id`);
      const gaps = findGaps(db.all('SELECT scope, store, num FROM items WHERE num IS NOT NULL'));
      const collisions = db.all(
        'SELECT scope, store, num, COUNT(*) c FROM items WHERE num IS NOT NULL GROUP BY scope, store, num HAVING c > 1');
      return { orphanParents, danglingLinks, gaps, collisions };
    },
  };
}

// Missing numbers within each (scope,store) sequence — reported, never auto-filled
// (KIT-T009: a returned next-id is always fresh; gaps from deletions stay gaps).
function findGaps(rows) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.scope}/${r.store}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r.num);
  }
  const gaps = [];
  for (const [k, nums] of byKey) {
    const set = new Set(nums);
    const max = Math.max(...nums);
    for (let n = 1; n < max; n++) if (!set.has(n)) gaps.push(`${k}#${n}`);
  }
  return gaps;
}

// ---- markdown-scan fallback (no SQLite engine) ----------------------------
// Mirrors each canned query against the parsed items so answers survive without a DB.
function fallback(cmd, args, root) {
  const items = collectItems(root);
  const byId = new Map(items.map((i) => [i.id, i]));
  switch (cmd) {
    case 'open': {
      const scope = args[0];
      return items.filter((i) => OPEN.includes(i.status) && !i.archived && !isSuperseded(i) && (!scope || i.scope === scope))
        .map((i) => ({ id: i.id, type: i.type, status: i.status, priority: i.priority, title: i.title }))
        .sort(compareOpen);
    }
    case 'children':
      return items.filter((i) => i.parent === args[0]).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    case 'backlinks': {
      const id = args[0];
      const out = [];
      for (const i of items) for (const [rel, to] of edgesOf(i)) {
        if (to === id) out.push({ id: i.id, type: i.type, status: i.status, rel, title: i.title });
      }
      return out.sort((a, b) => a.rel.localeCompare(b.rel) || compareIds(a.id, b.id));
    }
    case 'by-commit': {
      const sha = args[0];
      const out = [];
      for (const i of items) for (const [rel, to] of edgesOf(i)) {
        if ((rel === 'caused_by' || rel === 'fixed_by') && to === sha) {
          out.push({ id: i.id, type: i.type, status: i.status, rel, title: i.title });
        }
      }
      return out.sort((a, b) => a.rel.localeCompare(b.rel) || compareIds(a.id, b.id));
    }
    case 'doc-trail':
      return (byId.get(args[0])?.history || []).slice().sort((a, b) => String(b.ts).localeCompare(a.ts));
    case 'trail':
      return walkAncestry(
        args[0],
        (x) => { const it = byId.get(x); return it ? edgesOf(it) : []; },
        (x) => byId.get(x),
      );
    case 'fts': {
      const needle = args.join(' ').toLowerCase();
      return items.filter((i) => (`${i.title} ${i.body}`).toLowerCase().includes(needle))
        .slice(0, FTS_LIMIT).map((i) => ({ id: i.id, type: i.type, status: i.status, title: i.title }));
    }
    case 'rundown': {
      const m = new Map();
      for (const i of items) {
        if (i.archived) continue;
        const r = m.get(i.scope) || { scope: i.scope, open: 0, doing: 0, review: 0 };
        if (OPEN.includes(i.status)) r.open++;
        if (i.status === 'doing') r.doing++;
        if (i.status === 'review') r.review++;
        m.set(i.scope, r);
      }
      return [...m.values()].sort((a, b) => a.scope.localeCompare(b.scope));
    }
    case 'regressions':
      return items.filter((i) => i.store === 'tickets')
        .map((i) => ({
          id: i.id, title: i.title,
          regressed_from: i.regressedFrom || null,
          causing_commit: i.causingCommit || null,
          fixed_commit: i.fixedCommit || null,
        }))
        .sort((a, b) => compareIds(a.id, b.id));
    case 'supersedes':
      return items.filter((i) => i.store === 'tickets')
        .map((i) => ({ id: i.id, status: i.status, title: i.title, supersedes: i.supersedes || null }))
        .sort((a, b) => compareIds(a.id, b.id));
    case 'similar': {
      // Mirror the cache's FTS OR-match with a term-overlap scan: candidates sharing the most
      // proposal terms first (suggest-only). Excludes archived + already-superseded items, and
      // confines to the target store (KIT-T025) — same `--store` parse as the cache path.
      const { store, query } = parseSimilar(args.join(' '));
      const wanted = new Set((query.toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN));
      if (!wanted.size) return [];
      return items
        .filter((i) => i.store === store && !i.archived && i.status !== 'superseded')
        .map((i) => {
          const hay = new Set((`${i.title} ${i.body}`.toLowerCase().match(ALNUM_TERM) || []));
          let overlap = 0;
          for (const t of wanted) if (hay.has(t)) overlap++;
          return { row: { id: i.id, type: i.type, status: i.status, title: i.title }, overlap };
        })
        .filter((c) => c.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap || compareIds(a.row.id, b.row.id))
        .slice(0, FTS_LIMIT)
        .map((c) => c.row);
    }
    case 'next-id': {
      const [scope, type] = args;
      const store = storeForType(type);
      const max = items.filter((i) => i.scope === scope && i.store === store && i.num).reduce((a, i) => Math.max(a, i.num), 0);
      return [{ id: formatId(root, scope, type, max + 1), scope, type, num: max + 1 }];
    }
    // File-scoped governance (KIT-T049) — scan-only by nature: the governing fields
    // (`files`/`scope`/`paths`) and the FTS body aren't in the SQLite schema, so collectItems
    // IS the source whether or not an engine exists. `root` is the repo whose tree drift checks.
    case 'governing':
      return governing(items, args);
    case 'drift':
      return drift(items, (t) => existsSync(join(root, t)));
    default:
      throw new Error(`'${cmd}' has no markdown fallback (needs SQLite). sql/integrity require the cache.`);
  }
}

// ---- output ---------------------------------------------------------------
function printRows(rows, json) {
  if (json) { process.stdout.write(JSON.stringify(rows, null, 2) + '\n'); return; }
  if (!rows || (Array.isArray(rows) && !rows.length)) { process.stdout.write('(no results)\n'); return; }
  if (typeof rows === 'object' && !Array.isArray(rows)) {
    for (const [k, v] of Object.entries(rows)) {
      process.stdout.write(`${k}: ${Array.isArray(v) ? v.length : v}\n`);
      if (Array.isArray(v)) for (const r of v) process.stdout.write('  ' + compact(r) + '\n');
    }
    return;
  }
  for (const r of rows) process.stdout.write(compact(r) + '\n');
}
const compact = (r) =>
  typeof r === 'string' ? r : Object.values(r).map((v) => (v === null ? '' : String(v))).join('  ');

// Programmatic query surface — the SINGLE entry the process tooling (next-id, survey,
// orient) shares with the CLI, so cache-vs-scan parity lives in ONE place (KIT-T026).
// Runs a canned query against the cache, auto-(re)hydrating, and degrades to the
// db-parse markdown scan when no SQLite engine exists or `noDb` is set — fail-open, the
// cache is never a hard dependency. `root` forces single-scope; `cwdRoot` keys id-format
// (next-id) and seeds the fallback scan. Returns the same rows the CLI prints.
export async function query(cmd, args = [], { root, cwdRoot = root || process.cwd(), noDb = false, dbPath = defaultDbPath() } = {}) {
  // governing/drift are scan-only (the cache schema carries no files/scope/paths/body), so
  // route them straight to the markdown scan over cwdRoot regardless of the engine — the
  // fail-open path IS the only path for them. `cached:false` is honest: no SQLite involved.
  if (cmd === 'governing' || cmd === 'drift') {
    return { rows: fallback(cmd, args, cwdRoot), cached: false };
  }
  const handle = noDb ? null : await db(root, dbPath);
  if (!handle) {
    return { rows: fallback(cmd, args, cwdRoot), cached: false };
  }
  try {
    const Q = cannedQueries(cwdRoot);
    const fn = Q[cmd];
    if (!fn) throw new Error(`unknown query '${cmd}'.`);
    const rows = (cmd === 'fts' || cmd === 'similar') ? fn(handle, args.join(' ')) : fn(handle, ...args);
    return { rows, cached: true };
  } finally {
    handle.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  // --no-db forces the markdown-scan path (bypass a possibly-stale cache; also proves the
  // fallback works the same as when no SQLite engine is present).
  const noDb = argv.includes('--no-db');
  // --root forces a single-scope hydrate; absent, the cache is cross-scope (all registered
  // projects). `cwdRoot` is the local .ai used only for id-formatting (next-id / config key).
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? argv[ri + 1] : undefined;
  const cwdRoot = root || process.cwd();
  const FLAGS = new Set(['--json', '--no-db']);
  const rest = argv.filter((a, i) => !FLAGS.has(a) && a !== '--root' && argv[i - 1] !== '--root');
  const [cmd, ...args] = rest;
  if (!cmd) { process.stderr.write('usage: q.mjs <open|children|backlinks|trail|governing|drift|by-commit|doc-trail|fts|similar|next-id|rundown|regressions|supersedes|integrity|sql> [args]\n'); process.exit(2); }

  const dbPath = defaultDbPath();

  if (cmd === 'sql') {
    const handle = noDb ? null : await db(root, dbPath);
    if (!handle) { process.stderr.write('q: ad-hoc SQL needs a SQLite engine (none found).\n'); process.exit(1); }
    const sql = args.join(' ');
    if (!/^\s*(select|with|pragma|explain)\b/i.test(sql)) { process.stderr.write('q: only read-only SQL (SELECT/WITH/PRAGMA/EXPLAIN) — the cache is never written back.\n'); handle.close(); process.exit(1); }
    printRows(handle.all(sql), json);
    handle.close();
    return;
  }

  const { rows } = await query(cmd, args, { root, cwdRoot, noDb, dbPath });
  printRows(rows, json);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('q: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
