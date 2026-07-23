#!/usr/bin/env node
// t.mjs — the ONE tool for STRUCTURED mutations of the .ai store (KIT-T075 / KIT-D032).
//
// Every store-integrity failure in the review was a hand-edit failure: stale `doing`, INDEX
// drift, template placeholder text shipped in supersede fields, self-asserted statuses. This
// CLI centralizes the invariants — markdown files stay the durable truth, but the STRUCTURED
// parts (status, criterion ticks, typed links, scaffolding a new ticket) flow through one
// tool that validates, stamps history, regenerates the indexes, and ingests the cache in the
// SAME invocation. PROSE sections (Description / Notes body) stay direct-edit (Edit) — the
// boundary is "enforce structure with a tool, never lock the prose".
//
//   t new <type> "<title>" [--root <dir>]          scaffold a ticket (id minted, never picked)
//   t status <id> <state> [--human] [--note "…"] [--fixed-commit <sha>]
//   t tick <id> <ordinal|substring> [--note "…"]   check an acceptance box
//   t link <id> <rel> <target>                      supersedes|superseded_by|regressed_from|
//                                                   causing_commit|fixed_commit|parent|link
//
// IDs are NEVER hand-picked — `t new` mints via id-utils.nextId (KIT-D011). Every subcommand
// fails loudly on an unknown id rather than inventing one. After a mutation the CLI refreshes
// the derived board (index-tickets, which also reconciles supersede edges) and ingests the
// SQLite cache — both fail-open, so a missing engine never wedges a mutation.

import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { nextId, readIdConfig } from './id-utils.mjs';
import { buildComment, parseComments, recordAck } from './comments.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ID_RE = /^[A-Za-z]+-[A-Za-z]?\d+$/; // KIT-T075, KIT-D032
const SHA_RE = /^[0-9a-f]{7,40}$/i; // a git short/long sha

// A typed-link relation either points at another ITEM (id-shaped) or a COMMIT (sha-shaped).
// Anything else is rejected — `t link` never writes a free-text edge.
const LINK_RELS = {
  supersedes: 'id',
  superseded_by: 'id',
  regressed_from: 'id',
  parent: 'id',
  link: 'id',
  causing_commit: 'sha',
  fixed_commit: 'sha',
};

// --- frontmatter primitives (same line-wise, dependency-free shape the rest of the tooling
// uses; kept local so this tool has no cross-script coupling beyond id allocation) ----------

function splitFrontmatter(text) {
  const m = text.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!m) return null;
  return { open: m[1], fm: m[2], close: m[3], rest: text.slice(m[0].length) };
}

function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// Set a scalar in place, preserving the existing (possibly empty) line; append the key at the
// end of the block when absent. Mirrors reconcile-supersede.setField so an edge written here
// reads back identically to one the reconcile pass writes.
function setField(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `$1 ${value}`);
  return `${fm}\n${key}: ${value}`;
}

function addToList(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*(.*)$`, 'm');
  const m = fm.match(re);
  if (!m) return `${fm}\n${key}: [${value}]`;
  const cur = m[2].trim().replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  if (cur.includes(value)) return fm;
  cur.push(value);
  return fm.replace(re, `$1 [${cur.join(', ')}]`);
}

// `[2026-06-10 13:42]` — the timestamp shape db-parse.historyEvents parses (date + HH:MM).
function stamp() {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

// Append `line` under `## <heading>` in a markdown body, creating the section at the end when
// it is absent. The section ends at the next `## ` heading or EOF, so a History line lands
// inside History even when Notes follows it.
function appendUnderSection(body, heading, line) {
  const h = `## ${heading}`;
  const idx = body.indexOf(`${h}\n`) === -1 ? body.indexOf(h) : body.indexOf(`${h}\n`);
  if (idx === -1) {
    return `${body.replace(/\s+$/, '')}\n\n${h}\n${line}\n`;
  }
  const after = body.indexOf('\n## ', idx + h.length);
  const end = after === -1 ? body.length : after;
  const section = body.slice(idx, end).replace(/\s+$/, '');
  return body.slice(0, idx) + section + `\n${line}\n` + (after === -1 ? '' : body.slice(end));
}

// --- config (the taxonomy the mutations enforce) -------------------------------------------

// Read just the knobs the mutations need, line-wise (no yaml dep), mirroring the other tooling.
export function readConfig(root) {
  const out = {
    flow: ['todo', 'doing', 'review', 'done'],
    humanOnly: [],
    offBoard: ['superseded'],
    uatDefault: 'required',
    archiveDir: 'tickets/archive',
    classifications: [],
  };
  let cfg = '';
  try {
    cfg = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
  } catch {
    return out;
  }
  const arr = (re) => {
    const m = cfg.match(re);
    return m ? m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : null;
  };
  out.flow = arr(/^\s*flow:\s*\[([^\]]*)\]/m) || out.flow;
  out.humanOnly = arr(/^\s*human_only:\s*\[([^\]]*)\]/m) ?? out.humanOnly;
  out.offBoard = arr(/^\s*off_board:\s*\[([^\]]*)\]/m) || out.offBoard;
  const uat = cfg.match(/^uat:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+default:[ \t]*(\w+)/m);
  if (uat) out.uatDefault = uat[1];
  const arch = cfg.match(/archive_done_to:[ \t]*(\S+)/);
  if (arch) out.archiveDir = arch[1];
  // classification keys = the valid `t new` types (two-space-indented under `classifications:`)
  const lines = cfg.split('\n');
  let inBlock = false;
  for (const line of lines) {
    if (/^classifications:\s*$/.test(line)) { inBlock = true; continue; }
    if (inBlock) {
      if (/^\S/.test(line)) break;
      const m = line.match(/^\s{2}([A-Za-z][\w-]*):/);
      if (m) out.classifications.push(m[1]);
    }
  }
  return out;
}

// --- ticket lookup -------------------------------------------------------------------------

function ticketDirs(root) {
  const base = join(root, '.ai', 'tickets');
  return [base, join(base, 'archive')];
}

// Resolve an id to its on-disk file (active dir or archive). Throws loudly on an unknown id —
// no subcommand ever invents or guesses one.
export function findTicket(root, id) {
  for (const dir of ticketDirs(root)) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f === '_TEMPLATE.md' || f === 'INDEX.md') continue;
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const parts = splitFrontmatter(text);
      const fid = (parts && field(parts.fm, 'id')) || (f.match(/[A-Za-z]+-[A-Za-z]?\d+/) || [])[0];
      if (fid === id) return { id, path, dir, file: f, text, parts, archived: dir.endsWith('archive') };
    }
  }
  throw new Error(`unknown id '${id}' — no ticket file carries it (ids are minted by t new, never guessed)`);
}

// --- t new ---------------------------------------------------------------------------------

// Scaffold a ticket: mint the id (next-id owns minting), filename = id, complete VALID
// frontmatter + the section skeleton. The prose body stays a placeholder the author fills via
// Edit — this kills the T039-T043 class where a hand-copied template shipped with KIT-T000 and
// `<short imperative title>` still in the fields.
export function scaffoldNew(root, type, title) {
  const { classifications } = readConfig(root);
  if (!type) throw new Error('t new: a <type> is required');
  if (classifications.length && !classifications.includes(type)) {
    throw new Error(`t new: unknown type '${type}' (config.classifications: ${classifications.join(', ')})`);
  }
  if (!title || !title.trim()) throw new Error('t new: a non-empty "<title>" is required');
  const id = nextId(root, 'tickets');
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'ticket';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const path = join(root, '.ai', 'tickets', `${id}-${slug}.md`);
  if (existsSync(path)) throw new Error(`t new: ${path} already exists`);
  const doc = `---
id: ${id}
title: ${title.trim()}
type: ${type}
status: todo
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: ${now}
updated: ${now}
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [${stamp()}] (created) ${type} — ${title.trim()}
`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, doc);
  return { id, path };
}

// --- t status ------------------------------------------------------------------------------

function resolveUat(parts, cfg) {
  return field(parts.fm, 'uat') || cfg.uatDefault;
}

// Transition a ticket's status. Enforces config.statuses (target must be a known state),
// guards human_only / uat-required closes behind --human, stamps a (status) History line, and
// — for `done` — runs the done tail (archive + fixed_commit hygiene). Pure markdown mutation:
// the CLI main wraps this with the index/cache refresh so tests can drive it in isolation.
export function setStatus(root, id, state, opts = {}) {
  const cfg = readConfig(root);
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block to update`);
  const known = new Set([...cfg.flow, ...cfg.offBoard, ...cfg.humanOnly]);
  if (!known.has(state)) {
    throw new Error(`${id}: '${state}' is not a known status (flow: ${cfg.flow.join(', ')}; off-board: ${cfg.offBoard.join(', ')})`);
  }
  const from = field(t.parts.fm, 'status') || '—';

  const uatRequiredClose = state === 'done' && resolveUat(t.parts, cfg) === 'required';
  const humanGated = cfg.humanOnly.includes(state) || uatRequiredClose;
  if (humanGated && !opts.human) {
    const why = uatRequiredClose ? `uat=required for ${id}` : `'${state}' is human_only`;
    throw new Error(`${id}: ${why} — re-run with --human (this transition is the maintainer's call)`);
  }

  let fm = setField(t.parts.fm, 'status', state);
  fm = setField(fm, 'updated', new Date().toISOString().replace(/\.\d+Z$/, 'Z'));

  const type = field(t.parts.fm, 'type');
  const tailNotes = [];
  if (state === 'done' && (type === 'bug' || type === 'regression')) {
    if (opts.fixedCommit) {
      if (!SHA_RE.test(opts.fixedCommit)) throw new Error(`--fixed-commit '${opts.fixedCommit}' is not a sha`);
      fm = setField(fm, 'fixed_commit', opts.fixedCommit);
    } else if (!field(t.parts.fm, 'fixed_commit')) {
      tailNotes.push(`set fixed_commit on this ${type} (pass --fixed-commit <sha>) — regression tracking needs the fixing commit`);
    }
  }

  let body = appendUnderSection(t.parts.rest, 'History', `- [${stamp()}] (status) ${from} → ${state}`);
  if (opts.note) body = appendUnderSection(body, 'History', `- [${stamp()}] (comment) ${opts.note}`);

  const out = t.parts.open + fm + t.parts.close + body;
  writeFileSync(t.path, out);

  // done tail: archive the file so the active board stays small (config.history.archive_done_to).
  let movedTo = null;
  if (state === 'done' && !t.archived) {
    const archDir = join(root, '.ai', cfg.archiveDir);
    mkdirSync(archDir, { recursive: true });
    const dest = join(archDir, t.file);
    renameSync(t.path, dest);
    movedTo = dest;
  }
  return { id, from, to: state, path: movedTo || t.path, archived: !!movedTo, warnings: tailNotes };
}

// --- t tick --------------------------------------------------------------------------------

// Check an acceptance-criteria box. `selector` is a 1-based ordinal among the `- [ ]` lines, or
// a substring that uniquely matches one open criterion. Appends a (comment) History line so the
// tick is auditable. Refuses an out-of-range / ambiguous / already-checked selector loudly.
export function tick(root, id, selector, opts = {}) {
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);
  const body = t.parts.rest;
  const lines = body.split('\n');
  const boxIdx = [];
  for (let i = 0; i < lines.length; i++) if (/^\s*-\s*\[ \]/.test(lines[i])) boxIdx.push(i);
  if (!boxIdx.length) throw new Error(`${id}: no open acceptance criteria to tick`);

  let target;
  if (/^\d+$/.test(String(selector))) {
    const n = parseInt(selector, 10);
    if (n < 1 || n > boxIdx.length) throw new Error(`${id}: ordinal ${n} out of range (1..${boxIdx.length} open criteria)`);
    target = boxIdx[n - 1];
  } else {
    const needle = String(selector).toLowerCase();
    const hits = boxIdx.filter((i) => lines[i].toLowerCase().includes(needle));
    if (!hits.length) throw new Error(`${id}: no open criterion matches "${selector}"`);
    if (hits.length > 1) throw new Error(`${id}: "${selector}" matches ${hits.length} criteria — use an ordinal`);
    target = hits[0];
  }
  const text = lines[target].replace(/^\s*-\s*\[ \]\s*/, '').trim();
  lines[target] = lines[target].replace('[ ]', '[x]');
  let newBody = lines.join('\n');
  newBody = appendUnderSection(newBody, 'History', `- [${stamp()}] (comment) ticked: ${opts.note || text}`);
  writeFileSync(t.path, t.parts.open + t.parts.fm + t.parts.close + newBody);
  return { id, ticked: text, path: t.path };
}

// --- t link --------------------------------------------------------------------------------

// Write a TYPED link, shape-validated. `supersedes` is reciprocal: it writes the back-pointer
// AND flips the retired ticket to status: superseded on BOTH files, so the relationship is
// never left half-declared (the failure that shipped placeholder text in supersede fields).
export function link(root, id, rel, target) {
  const kind = LINK_RELS[rel];
  if (!kind) throw new Error(`t link: unknown rel '${rel}' (one of: ${Object.keys(LINK_RELS).join(', ')})`);
  if (kind === 'id' && !ID_RE.test(target)) throw new Error(`t link: '${target}' is not an id-shaped target for ${rel}`);
  if (kind === 'sha' && !SHA_RE.test(target)) throw new Error(`t link: '${target}' is not a sha for ${rel}`);

  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);

  if (rel === 'link') {
    const fm = addToList(t.parts.fm, 'links', target);
    writeFileSync(t.path, t.parts.open + fm + t.parts.close + t.parts.rest);
    return { id, rel, target };
  }

  if (rel === 'supersedes' || rel === 'superseded_by') {
    // Normalize to (newer supersedes older) regardless of which side was named.
    const newer = rel === 'supersedes' ? id : target;
    const older = rel === 'supersedes' ? target : id;
    const nt = findTicket(root, newer);
    const ot = findTicket(root, older);
    const nfm = setField(nt.parts.fm, 'supersedes', older);
    writeFileSync(nt.path, nt.parts.open + nfm + nt.parts.close + nt.parts.rest);
    let ofm = setField(ot.parts.fm, 'superseded_by', newer);
    ofm = setField(ofm, 'status', 'superseded');
    const obody = appendUnderSection(ot.parts.rest, 'History', `- [${stamp()}] (status) → superseded (by ${newer})`);
    writeFileSync(ot.path, ot.parts.open + ofm + ot.parts.close + obody);
    return { id, rel, target, newer, older, bothSides: true };
  }

  // single-sided provenance scalar (regressed_from / causing_commit / fixed_commit / parent)
  const fm = setField(t.parts.fm, rel, target);
  writeFileSync(t.path, t.parts.open + fm + t.parts.close + t.parts.rest);
  return { id, rel, target };
}

// --- t comment ----------------------------------------------------------------------------

// Append a durable authored comment as a History `(comment)` event. Multi-line / long prose
// spills to ## Notes with the History line referencing it (comments.buildComment owns the
// shape). @mentions are DERIVED on read, never stored. Pure markdown mutation; the CLI main
// wraps this with the index/cache refresh (comment activity lands in the cache history table).
export function comment(root, id, text, opts = {}) {
  const author = (opts.author || '').trim();
  if (!author) throw new Error('t comment: --author <who> is required');
  if (text === undefined || !String(text).trim()) throw new Error('t comment: a non-empty "<text>" is required');
  const t = findTicket(root, id);
  if (!t.parts) throw new Error(`${id}: no frontmatter block`);
  const built = buildComment(t.parts.rest, { id, author, text, ts: stamp() });
  let body = appendUnderSection(t.parts.rest, 'History', built.historyLine);
  if (built.notesBlock) body = appendUnderSection(body, 'Notes', built.notesBlock);
  writeFileSync(t.path, t.parts.open + t.parts.fm + t.parts.close + body);
  return { id, ref: built.ref, ordinal: built.ordinal, mentions: built.mentions, spilled: !!built.notesBlock, path: t.path };
}

// --- t ack --------------------------------------------------------------------------------

// Record a per-agent read receipt for one comment. The reference is `<id>#<ordinal>` — the
// ticket id plus the comment's 1-based ordinal (append-only, so unambiguous). Verifies the
// comment exists before writing the receipt; acked mentions stop surfacing at orient/drain.
export function ack(root, refToken, opts = {}) {
  const agent = (opts.agent || '').trim();
  if (!agent) throw new Error('t ack: --agent <name> is required');
  const m = String(refToken || '').match(/^([A-Za-z]+-[A-Za-z]?\d+)#(\d+)$/);
  if (!m) throw new Error(`t ack: reference must be <id>#<comment-ordinal> (e.g. KIT-T130#2), got '${refToken}'`);
  const id = m[1];
  const ordinal = parseInt(m[2], 10);
  const t = findTicket(root, id);
  const comments = parseComments(t.parts ? t.parts.rest : t.text);
  const target = comments.find((c) => c.ordinal === ordinal);
  if (!target) throw new Error(`${id}: no comment #${ordinal} (ticket carries ${comments.length} comment(s))`);
  const rec = recordAck(root, { ref: `${id}#${ordinal}`, agent, ts: target.tsKey });
  return { id, ref: rec.ref, agent: rec.agent, already: rec.already, mentions: target.mentions };
}

// --- write-time structure lint (shared with hooks/ingest-data.mjs) -------------------------

const PLACEHOLDERS = [
  /id:\s*[A-Za-z]+-[A-Za-z]?0+\b/, // the template sentinel id (KIT-T000)
  /title:\s*<[^>]+>/, // <short imperative title>
  /<YYYY-MM-DD/, // unfilled timestamp placeholder
];

// Surface STRUCTURAL problems on a store file — named, never blocking. Returns a list of
// human-readable warnings (empty = clean). The hook fails open: it emits these to stderr and
// always exits 0, so a malformed file is flagged but the write still lands (suspenders to the
// CLI's belt). Prose is never judged here — only the frontmatter envelope + leftover template.
export function lintStoreText(text, relpath = '') {
  const warns = [];
  const needsFm = /(^|[\\/])(tickets|decisions)[\\/]/.test(relpath) || relpath === '';
  const parts = splitFrontmatter(text);
  if (!parts) {
    if (needsFm && /^---/.test(text)) warns.push('frontmatter: opening `---` without a closing `---` (malformed block)');
    return warns;
  }
  if (!field(parts.fm, 'id')) warns.push('frontmatter: missing `id:`');
  const status = field(parts.fm, 'status');
  if (parts.fm.match(/^status:/m) && !status) warns.push('frontmatter: empty `status:`');
  for (const re of PLACEHOLDERS) {
    if (re.test(parts.fm)) { warns.push('frontmatter: unfilled template placeholder still present (run `t new`, do not copy the template by hand)'); break; }
  }
  return warns;
}

// --- evidence floor (shared with commit-gate + ingest-data; KIT-T061) ----------------------

// The explicit, documented non-evidence path — same philosophy as the commit gate's [no-log:].
export const NO_TEST_ESCAPE = /\[no-test:\s*[^\]]+\]/i;

// What COUNTS as test evidence in a ticket's Notes/History (or a frontmatter fixed_commit):
// a test file path, a suite-run reference, or a commit sha. Deliberately broad — the floor is a
// floor, and over-strictness causes false blocks; the explicit [no-test:] escape is the relief
// valve, not a tight evidence grammar.
export const EVIDENCE_PATTERNS = [
  /\b[\w./-]+\.(?:test|spec)\.[a-z]+\b/i,        // scripts/foo.test.mjs, app.spec.ts
  /\btests?[\\/][\w./-]+/i,                        // a test/ or tests/ path
  /\b(?:npm|pnpm|yarn)\s+test\b/i,                // suite-run reference
  /\bnode\s+--test\b/i,
  /\b(?:pytest|go\s+test|cargo\s+test|jest|vitest|mocha)\b/i,
  /\b\d+\s+(?:pass(?:ed|ing)|tests? pass)/i,      // "43 passed", "5 passing"
  /\bsuite green\b/i,
  /\b[0-9a-f]{7,40}\b/,                            // a test/fixing commit sha
];

// Resolve whether a ticket file's text sits at its CLOSING transition for the project's uat
// resolution (KIT-D034) and whether it carries the required evidence. PURE — the commit-gate
// (blocker) and ingest-data (advisory) decide what to DO with `needsEvidence`. The closing
// transition is doing→review where uat resolves `required`, doing→done where `none`; a
// per-ticket `uat:` frontmatter field overrides the project default.
export function evidenceFloor(text, uatDefault = 'required') {
  const parts = splitFrontmatter(text);
  const status = parts ? field(parts.fm, 'status') : '';
  const uat = (parts && field(parts.fm, 'uat')) || uatDefault;
  const closing = uat === 'required' ? 'review' : 'done';
  const atClosing = status === closing;
  const hasEvidence = EVIDENCE_PATTERNS.some((re) => re.test(text));
  const hasEscape = NO_TEST_ESCAPE.test(text);
  return { status, closing, atClosing, hasEvidence, hasEscape, needsEvidence: atClosing && !hasEvidence && !hasEscape };
}

// --- refresh (CLI-only side effect) --------------------------------------------------------

// Regenerate the derived board + ingest the cache after a mutation, BOTH fail-open. index-tickets
// also runs the supersede reconcile/dedup pass, so a one-sided edge is made consistent here.
async function refresh(root) {
  try {
    execFileSync('node', [join(SCRIPT_DIR, 'index-tickets.mjs'), root], { stdio: 'ignore' });
  } catch { /* board regen is best-effort; the markdown is already the truth */ }
  try {
    const { hydrate, defaultDbPath } = await import('./hydrate-db.mjs');
    await hydrate({ root, dbPath: defaultDbPath() });
  } catch { /* the cache is derived + optional — never a hard dependency */ }
}

// --- CLI -----------------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--human') flags.human = true;
    else if (a === '--note') flags.note = argv[++i];
    else if (a === '--fixed-commit') flags.fixedCommit = argv[++i];
    else if (a === '--author') flags.author = argv[++i];
    else if (a === '--agent') flags.agent = argv[++i];
    else if (a === '--root') flags.root = argv[++i];
    else pos.push(a);
  }
  return { flags, pos };
}

async function main() {
  const { flags, pos } = parseArgs(process.argv.slice(2));
  const root = flags.root || process.cwd();
  const [cmd, ...rest] = pos;
  const usage = 'usage: t <new|status|tick|link|comment|ack> …  (t new <type> "<title>" | t status <id> <state> [--human] | t tick <id> <ordinal|match> | t link <id> <rel> <target> | t comment <id> "<text>" --author <who> | t ack <id>#<n> --agent <name>)';

  if (!cmd) { console.error(usage); process.exit(2); }

  if (cmd === 'new') {
    const [type, ...titleWords] = rest;
    const { id, path } = scaffoldNew(root, type, titleWords.join(' '));
    await refresh(root);
    process.stdout.write(`new: ${id} -> ${path.replace(resolve(root) + '/', '').replace(resolve(root) + '\\', '')}\n`);
    return;
  }
  if (cmd === 'status') {
    const [id, state] = rest;
    if (!id || !state) { console.error('usage: t status <id> <state> [--human] [--note "…"] [--fixed-commit <sha>]'); process.exit(2); }
    const r = setStatus(root, id, state, flags);
    await refresh(root);
    process.stdout.write(`status: ${r.id} ${r.from} → ${r.to}${r.archived ? ' (archived)' : ''}\n`);
    for (const w of r.warnings) process.stderr.write(`  ⚠ ${w}\n`);
    return;
  }
  if (cmd === 'tick') {
    const [id, selector] = rest;
    if (!id || selector === undefined) { console.error('usage: t tick <id> <ordinal|substring> [--note "…"]'); process.exit(2); }
    const r = tick(root, id, selector, flags);
    await refresh(root);
    process.stdout.write(`tick: ${r.id} ✓ ${r.ticked}\n`);
    return;
  }
  if (cmd === 'link') {
    const [id, rel, target] = rest;
    if (!id || !rel || !target) { console.error('usage: t link <id> <rel> <target>'); process.exit(2); }
    const r = link(root, id, rel, target);
    await refresh(root);
    process.stdout.write(`link: ${r.id} ${r.rel} ${r.target}${r.bothSides ? ` (+ ${r.older}.superseded_by = ${r.newer})` : ''}\n`);
    return;
  }
  if (cmd === 'comment') {
    const [id, ...textWords] = rest;
    const text = textWords.join(' ');
    if (!id || !text.trim()) { console.error('usage: t comment <id> "<text>" --author <who>'); process.exit(2); }
    const r = comment(root, id, text, flags);
    await refresh(root);
    const mentioned = r.mentions.length ? ` — mentions ${r.mentions.map((m) => '@' + m).join(' ')}` : '';
    process.stdout.write(`comment: ${r.ref} by @${flags.author}${r.spilled ? ' (body → Notes)' : ''}${mentioned}\n`);
    return;
  }
  if (cmd === 'ack') {
    const [refToken] = rest;
    if (!refToken) { console.error('usage: t ack <id>#<comment-ordinal> --agent <name>'); process.exit(2); }
    const r = ack(root, refToken, flags);
    process.stdout.write(`ack: ${r.ref} by ${r.agent}${r.already ? ' (already acked)' : ''}\n`);
    return;
  }
  console.error(`t: unknown subcommand '${cmd}'\n${usage}`);
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write('t: ' + (e && e.message ? e.message : e) + '\n');
    process.exit(1);
  });
}
