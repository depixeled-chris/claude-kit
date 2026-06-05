// Shared ID logic for the .ai markdown stores — allocation + integrity, served
// from a dependency-free markdown scan. This is the markdown-served carve-out of
// KIT-T004 (the SQLite cache) that the ticket licenses landing early: "next-ID
// doesn't have to wait for SQLite — it can serve from the markdown scan today".
//
// The scheme is <KEY>-<TYPE><NUM> (KIT-D011): KEY = project key (config ids.key),
// TYPE = store letter (ticket=T, decision=D, note=N, question=Q), NUM = counter.
// IDs are assigned by `nextId` (max+1), never hand-picked — that is what kept two
// files colliding on HOD-T045.
//
// `pad` (config ids.pad) is COSMETIC ONLY — a minimum display width. A project that
// blows past it (e.g. KIT-T1000 with pad 3) is fine: nextId widens the number and
// `compareIds` orders numerically, so 1000 sorts after 999. Nothing here depends on a
// fixed width, so there is no ceiling — `pad: 3` is not a 999-id limit.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// STORE_TYPE drives ID ALLOCATION (the <KEY>-<TYPE><NUM> letter), so only the stores that
// mint frontmatter ids belong here. The cache must index MORE than these — inbox caps and
// questions are tracked items too — so the set of dirs to SCAN is derived separately
// (storeDirs), not from STORE_TYPE. Conflating the two is what omitted inbox/questions from
// the cache (KIT-T026/KIT-D024: index EVERY tracked item).
export const STORE_TYPE = { tickets: 'T', decisions: 'D', notes: 'N', questions: 'Q' };

// Generated/reference files in a store dir that are not items.
const SKIP = new Set(['_TEMPLATE.md', 'README.md', 'INDEX.md', 'REGRESSIONS.md', 'ROADMAP.md']);

// The store subdirectories to index, in a stable order. The id-minting stores come first
// (so an id-collision scan is deterministic), then the capture/queue stores that hold
// id-less items the cache must still see. Any OTHER store dir present under .ai is picked up
// too (KIT-D024: stay open to new stores), excluding the generated `archive` (handled per
// store) — so adding a store dir needs no code change here.
const KNOWN_STORE_ORDER = ['tickets', 'decisions', 'notes', 'questions', 'inbox'];
const NON_STORE_DIRS = new Set(['archive']);

function storeDirs(ai) {
  const present = [];
  let entries = [];
  try {
    entries = readdirSync(ai, { withFileTypes: true });
  } catch {
    return [];
  }
  const have = new Set(
    entries.filter((e) => e.isDirectory() && !NON_STORE_DIRS.has(e.name)).map((e) => e.name),
  );
  for (const s of KNOWN_STORE_ORDER) if (have.has(s)) present.push(s);
  for (const s of have) if (!present.includes(s)) present.push(s); // any extra store dir
  return present;
}

// config.yml is read line-wise (no YAML dep), mirroring the other tooling. `aiDir`
// overrides the default <root>/.ai derivation, so a central-data store (where the
// notebook dir IS the .ai dir) can be read directly (KIT-T031).
export function readIdConfig(root, aiDir = join(root, '.ai')) {
  let key = '';
  let pad = 3;
  try {
    const cfg = readFileSync(join(aiDir, 'config.yml'), 'utf8');
    const km = cfg.match(/^[ \t]*key:[ \t]*["']?([A-Za-z]+)["']?/m);
    if (km) key = km[1];
    const pm = cfg.match(/^[ \t]*pad:[ \t]*(\d+)/m);
    if (pm) pad = parseInt(pm[1], 10);
  } catch {
    /* defaults */
  }
  return { key, pad };
}

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : '';
}

function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// The leading id token of a filename: HOD-T045-foo.md -> HOD-T045 (also legacy
// R045 / D-010 forms, so a mid-migration store still scans).
function idFromFilename(f) {
  const m = f.match(/^([A-Za-z]+-?(?:[A-Za-z]\d+|\d+))/);
  return m ? m[1] : '';
}

// Every item across every store: { id, store, sub, file, fmId, fileId }. The
// canonical id prefers frontmatter, falling back to the filename. `aiDir` overrides
// the <root>/.ai derivation for central-data stores (KIT-T031).
export function scanStores(root, aiDir = join(root, '.ai')) {
  const ai = aiDir;
  const items = [];
  for (const store of storeDirs(ai)) {
    // `sub` is kept POSIX (forward-slash) so reported paths read identically on every
    // OS; path.join only ever wraps it for the actual filesystem read.
    const subdirs = store === 'tickets' ? [store, `${store}/archive`] : [store];
    for (const sub of subdirs) {
      const dir = join(ai, sub);
      if (!existsSync(dir)) continue;
      for (const f of readdirSync(dir)) {
        if (extname(f) !== '.md' || SKIP.has(f)) continue;
        const fmId = field(frontmatter(readFileSync(join(dir, f), 'utf8')), 'id');
        const fileId = idFromFilename(f);
        items.push({ id: fmId || fileId, store, sub, file: f, fmId, fileId });
      }
    }
  }
  return items;
}

// STAT-ONLY enumeration of every indexed markdown file under an .ai store dir — the basis of
// the incremental sync (KIT-T026/KIT-D024). Yields one entry per file with the scan fields
// (store/sub/file/relpath) PLUS its {mtimeMs, size}, and NEVER reads a file body. The sync
// diffs these stats against the stored `source_files` manifest to find the dirty set, so an
// unchanged file is never opened. `relpath` (`sub/file`, POSIX) is the manifest key and
// matches the items.file column. Best-effort: an unreadable dir/file is skipped, not thrown.
export function statStoreFiles(aiDir) {
  const out = [];
  for (const store of storeDirs(aiDir)) {
    const subdirs = store === 'tickets' ? [store, `${store}/archive`] : [store];
    for (const sub of subdirs) {
      const dir = join(aiDir, sub);
      let entries;
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const f of entries) {
        if (extname(f) !== '.md' || SKIP.has(f)) continue;
        let st;
        try {
          st = statSync(join(dir, f));
        } catch {
          continue;
        }
        out.push({ store, sub, file: f, relpath: `${sub}/${f}`, mtimeMs: st.mtimeMs, size: st.size });
      }
    }
  }
  return out;
}

// A store-relative path for human-readable output — always POSIX-style, so the same
// finding prints the same on Windows, macOS, and Linux.
const relPath = (it) => `${it.sub}/${it.file}`;

// Same id on two+ files — the failure that motivated this module.
export function findCollisions(items) {
  const byId = new Map();
  for (const it of items) {
    if (!it.id) continue;
    if (!byId.has(it.id)) byId.set(it.id, []);
    byId.get(it.id).push(it);
  }
  return [...byId.entries()]
    .filter(([, arr]) => arr.length > 1)
    .map(([id, arr]) => ({ id, files: arr.map(relPath) }));
}

// A file whose frontmatter id disagrees with its filename — the next-most-likely
// way an id drifts (rename one, forget the other).
export function findMismatches(items) {
  return items
    .filter((it) => it.fmId && it.fileId && it.fmId !== it.fileId)
    .map((it) => ({ file: relPath(it), fmId: it.fmId, fileId: it.fileId }));
}

// Order ids so width never affects sort: a non-digit prefix (KEY-TYPE) compared
// lexically, then the trailing number compared NUMERICALLY (so KIT-T1000 follows
// KIT-T999, which a plain string compare gets backwards). Use this anywhere ids are
// sorted instead of String#localeCompare.
export function compareIds(a, b) {
  const pa = String(a).match(/^(.*?)(\d+)$/);
  const pb = String(b).match(/^(.*?)(\d+)$/);
  if (!pa || !pb) return String(a).localeCompare(String(b));
  return pa[1].localeCompare(pb[1]) || parseInt(pa[2], 10) - parseInt(pb[2], 10);
}

// One call for the hooks: integrity over a whole project's stores.
export function checkIds(root) {
  const items = scanStores(root);
  return { duplicates: findCollisions(items), mismatches: findMismatches(items) };
}

// The next free id for a store: max trailing number + 1 (KIT-T004). Gaps from
// deletions are intentionally not reused — a returned id is always fresh.
export function nextId(root, store) {
  const letter = STORE_TYPE[store];
  if (!letter) {
    throw new Error(`unknown store '${store}' (one of: ${Object.keys(STORE_TYPE).join(', ')})`);
  }
  const { key, pad } = readIdConfig(root);
  if (!key) throw new Error(`no ids.key in ${join(root, '.ai', 'config.yml')}`);
  let max = 0;
  for (const it of scanStores(root)) {
    if (it.store !== store) continue;
    const m = (it.id || '').match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${key}-${letter}${String(max + 1).padStart(pad, '0')}`;
}
