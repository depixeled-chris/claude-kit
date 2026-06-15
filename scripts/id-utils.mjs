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
export const STORE_TYPE = { tickets: 'T', decisions: 'D', notes: 'N', questions: 'Q', requests: 'R', epics: 'E' };

// Generated/reference files in a store dir that are not items.
const SKIP = new Set(['_TEMPLATE.md', 'README.md', 'INDEX.md', 'REGRESSIONS.md', 'ROADMAP.md']);

// The store subdirectories to index, in a stable order. The id-minting stores come first
// (so an id-collision scan is deterministic), then the capture/queue stores that hold
// id-less items the cache must still see. Any OTHER store dir present under .ai is picked up
// too (KIT-D024: stay open to new stores), excluding the generated `archive` (handled per
// store) — so adding a store dir needs no code change here.
const KNOWN_STORE_ORDER = ['tickets', 'decisions', 'notes', 'questions', 'inbox', 'requests', 'epics'];
// `resolved` is an immutable audit log (cap --done), NOT a triage queue — its records must
// never be counted as open work. `archive` holds done tickets (same reason). (KIT-D036)
// `reminders` is a user-defined NAG store on a FIXED, UNKEYED `REM-###` id (KIT-T090) — it is
// NOT a `<KEY>-<TYPE><NUM>` work store, so the keyed-id machinery (scanStores → nextId / the
// id-collision scan / the board / the cache) must never treat REM files as keyed items. The
// reminders CLI (rem.mjs) scans `.ai/reminders/` directly; nothing keyed needs to see it.
const NON_STORE_DIRS = new Set(['archive', 'resolved', 'reminders']);

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

// The provenance markers KIT-T065 writes on accepted inference. A regression ticket
// that carries either of these on ANY of its link fields is considered provenanced —
// the maintainer accepted the inferred links, so the integrity check is satisfied.
const PROVENANCE_OK = new Set(['inferred', 'given']);

// Regression tickets missing their backward-provenance links — the enforcement
// KIT-T066 adds. A `type: regression` ticket must name at least one of:
//   • `regressed_from`  (the ticket/decision it broke)
//   • `causing_commit`  (the offending commit sha)
//   • `provenance: inferred|given`  (resolver already ran + was accepted)
// Additionally, a `done` regression without a `fixed_commit` is also flagged
// (paired with /done's own prompt — KIT-T060). A non-regression ticket is
// never touched by this check.
//
// `aiDir` is the resolved .ai directory (not the project root) so central-data
// stores pass the right path without double-derivation.
export function findRegressionGaps(aiDir) {
  const gaps = [];
  // sub is POSIX-style (matches relPath convention in the rest of this file)
  const subdirs = [{ sub: 'tickets', dir: join(aiDir, 'tickets') }, { sub: 'tickets/archive', dir: join(aiDir, 'tickets', 'archive') }];
  for (const { sub, dir } of subdirs) {
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const f of entries) {
      if (extname(f) !== '.md' || SKIP.has(f)) continue;
      let text;
      try { text = readFileSync(join(dir, f), 'utf8'); } catch { continue; }
      const fm = frontmatter(text);
      if (!fm) continue;
      const type = field(fm, 'type');
      if (type !== 'regression') continue;

      const id = field(fm, 'id') || idFromFilename(f);
      const status = field(fm, 'status');
      const regressedFrom = field(fm, 'regressed_from');
      const causingCommit = field(fm, 'causing_commit');
      const provenance = field(fm, 'provenance');
      const fixedCommit = field(fm, 'fixed_commit');

      // A provenance marker satisfies the link requirement on its own.
      const hasProvenance = PROVENANCE_OK.has(provenance);
      const hasLink = regressedFrom || causingCommit || hasProvenance;

      if (!hasLink) {
        gaps.push({ id, file: `${sub}/${f}`, reason: 'missing provenance links (regressed_from / causing_commit / provenance:)' });
      }
      if (status === 'done' && !fixedCommit) {
        gaps.push({ id, file: `${sub}/${f}`, reason: 'done regression missing fixed_commit' });
      }
    }
  }
  return gaps;
}

// One call for the hooks: integrity over a whole project's stores.
export function checkIds(root, aiDir = join(root, '.ai')) {
  const items = scanStores(root, aiDir);
  return {
    duplicates: findCollisions(items),
    mismatches: findMismatches(items),
    regressionGaps: findRegressionGaps(aiDir),
  };
}

// The next free id for a store: max trailing number + 1 (KIT-T004). Gaps from
// deletions are intentionally not reused — a returned id is always fresh.
export function nextId(root, store) {
  const letter = STORE_TYPE[store];
  if (!letter) {
    throw new Error(`unknown store '${store}' (one of: ${Object.keys(STORE_TYPE).join(', ')})`);
  }
  const { key, pad } = readIdConfig(root);
  if (!key) throw new Error(
    `no ids.key in ${join(root, '.ai', 'config.yml')} — ` +
    `add an ids block to that file, e.g.:\n` +
    `  ids:\n    key: HOD   # your project's 2-4 letter prefix\n    pad: 3`,
  );
  let max = 0;
  for (const it of scanStores(root)) {
    if (it.store !== store) continue;
    const m = (it.id || '').match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${key}-${letter}${String(max + 1).padStart(pad, '0')}`;
}

// Reminders are the one store on a FIXED, UNKEYED id (KIT-T090): `REM-###`, NOT
// `<KEY>-<TYPE><NUM>`. They are user-defined recurring nags, not keyed work, so the id reads
// identically in every project and never collides with a project's R-prefixed requests
// (`REM-001` ≠ `HOD-R001`). This is why reminders are excluded from STORE_TYPE / scanStores and
// get their own minter: scan `.ai/reminders/REM-*.md` for the max trailing number and return
// the next, padded to 3. Gaps from deletions are not reused (a returned id is always fresh).
const REM_PAD = 3;
export function nextReminderId(root) {
  let max = 0;
  try {
    const dir = join(root, '.ai', 'reminders');
    for (const f of readdirSync(dir)) {
      if (extname(f) !== '.md' || SKIP.has(f)) continue;
      const m = f.match(/^REM-(\d+)/);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
  } catch {
    /* no reminders dir yet — REM-001 is the first */
  }
  return `REM-${String(max + 1).padStart(REM_PAD, '0')}`;
}
