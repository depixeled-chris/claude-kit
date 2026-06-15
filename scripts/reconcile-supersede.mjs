#!/usr/bin/env node
// reconcile-supersede.mjs — make ticket supersede relationships SELF-CONSISTENT in the
// markdown source of truth (KIT-D021: automate over manual; KIT-T024).
//
// When a supersede relationship is declared on EITHER side — a newer ticket's
// `supersedes: OLD`, or an old ticket's `superseded_by: NEW` — this pass AUTOMATICALLY and
// IDEMPOTENTLY:
//   1. writes the reciprocal pointer on the other ticket if missing
//      (NEW.supersedes:OLD  ⟺  OLD.superseded_by:NEW), and
//   2. sets the retired (superseded) ticket's frontmatter `status: superseded`.
//
// This is the TOOLING writing the markdown source of truth — allowed (the same way
// index-tickets writes the derived board). It is NOT cache write-back: the SQLite cache
// stays one-way/read-only/fail-open. It runs inside index-tickets (the automatic board
// reconcile pass), OUT of the PreToolUse/commit enforcement hot path.
//
// Safety: only ever flips a ticket TO `superseded`; never un-flips, never edits a ticket
// that has no supersede pointer on either side, never touches the live replacement's status.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from './q.mjs';
import { compareIds } from './id-utils.mjs';
import { writeItemFile } from '../hooks/lib.mjs';

const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md']);

function splitFrontmatter(text) {
  const m = text.match(/^(---\n)([\s\S]*?)(\n---)/);
  if (!m) return null;
  return { open: m[1], fm: m[2], close: m[3], rest: text.slice(m[0].length) };
}

function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// Set a frontmatter scalar, preserving an existing (possibly empty) line in place; append a
// new line at the end of the block if the key is absent. Returns the new frontmatter text.
function setField(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `$1 ${value}`);
  return `${fm}\n${key}: ${value}`;
}

function ticketFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .map((f) => join(dir, f));
}

// Normalized title key for the UNAMBIGUOUS-duplicate test: lowercase, strip every char
// that isn't a letter/digit/space, then collapse runs of whitespace. Two tickets share a
// key only when their titles are identical modulo case / punctuation / spacing — a strict
// bar by design (HOD policy: "unambiguous" = near-certain, not merely similar).
function normTitleKey(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z\d\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Auto-dedup of UNAMBIGUOUS ticket duplicates (KIT-T025, locked policy option C; KIT-D021:
// automate > remembered-manual). Tickets ONLY — decisions/notes/questions stay suggest-only
// (a "duplicate" there is often deliberate nuance, e.g. a decision refining another). Never
// merges across scopes.
//
// A pair is auto-resolved ONLY when BOTH strict conditions hold:
//   1. same scope + IDENTICAL normalized title (normTitleKey), and
//   2. the KIT-T024 `similar` detector independently surfaces the other ticket as a
//      same-store candidate (shared-term/FTS overlap above its conservative bar).
// Reusing `query('similar')` ties the title match to the existing detector instead of
// re-deriving similarity (DRY) — identical titles guarantee full term overlap, so (2) is a
// belt-and-suspenders guard that also excludes anything the detector wouldn't flag.
//
// SURVIVOR RULE (deterministic): the LOWER id survives as canonical/original; the HIGHER id
// (the later duplicate) is superseded. We only WRITE the `supersedes` edge here (survivor →
// loser); the reconcile pass below then flips the loser's status + writes the reciprocal,
// so resolution flows through the one KIT-T024 mechanism rather than a second flip.
//
// Idempotent: once the edge exists the pair is already superseded (dropped from the active
// candidate set), so a re-run finds nothing. Returns { changed, scanned } for logging.
export async function autoDedupTickets(root) {
  const dir = join(root, '.ai', 'tickets');
  const files = ticketFiles(dir);

  // Active tickets only: skip anything already retired so a re-run is a no-op.
  const active = [];
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    const parts = splitFrontmatter(text);
    if (!parts) continue;
    const id = field(parts.fm, 'id') || (path.match(/[A-Za-z]+-\d+/) || [])[0];
    if (!id) continue;
    if (field(parts.fm, 'status') === 'superseded' || field(parts.fm, 'superseded_by')) continue;
    const scope = (id.match(/^([A-Za-z]+)-/) || [])[1] || '';
    active.push({ id, scope, path, parts, title: field(parts.fm, 'title') });
  }

  // Group by (scope + normalized title); only groups with >1 member are duplicate clusters.
  const groups = new Map();
  for (const t of active) {
    const key = normTitleKey(t.title);
    if (!key) continue; // a blank title can't be an unambiguous duplicate of anything
    const gk = `${t.scope} ${key}`;
    (groups.get(gk) || groups.set(gk, []).get(gk)).push(t);
  }

  const changed = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    members.sort((a, b) => compareIds(a.id, b.id)); // lower id first = survivor
    const survivor = members[0];

    // Already linked to a different ticket → leave the whole cluster for the operator rather
    // than overwrite a deliberate edge (a survivor retiring multiple dups would need a list;
    // in practice clusters are pairs).
    if (field(survivor.parts.fm, 'supersedes')) continue;

    // Confirm via the KIT-T024 detector: each loser must be an independently-surfaced
    // same-store candidate for the survivor's title. One shared query per group.
    let candidateIds;
    try {
      const { rows } = await query('similar', ['--store', 'tickets', survivor.title], { root });
      candidateIds = new Set(rows.map((r) => r.id));
    } catch {
      continue; // detector unavailable → stay conservative, resolve nothing this run
    }

    const loser = members.find((m) => m !== survivor && candidateIds.has(m.id));
    if (!loser) continue; // detector didn't confirm any cluster member → not unambiguous

    survivor.parts = { ...survivor.parts, fm: setField(survivor.parts.fm, 'supersedes', loser.id) };
    const out = survivor.parts.open + survivor.parts.fm + survivor.parts.close + survivor.parts.rest;
    await writeItemFile(survivor.path, out);
    changed.push(`${survivor.id} supersedes ${loser.id} (auto-dedup: identical title "${normTitleKey(survivor.title)}", detector-confirmed)`);
  }

  return { changed, scanned: active.length };
}

// Reconcile every ticket under <root>/.ai/tickets (active set only — archived tickets are
// frozen and excluded). Returns { changed: [...descriptions], scanned } so callers can log.
export async function reconcileSupersede(root) {
  const dir = join(root, '.ai', 'tickets');
  const files = ticketFiles(dir);

  // First pass: load every ticket's parsed frontmatter + raw text, keyed by id.
  const byId = new Map();
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    const parts = splitFrontmatter(text);
    if (!parts) continue;
    const id = field(parts.fm, 'id') || (path.match(/[A-Za-z]+-\d+/) || [])[0];
    if (!id) continue;
    byId.set(id, { path, text, parts, id });
  }

  // Resolve every declared edge to a canonical (newer→older) pair, from whichever side it
  // was declared. `supersedes` (newer→older) and `superseded_by` (older→newer) are the two
  // directions of the same relationship; collect both so a one-sided declaration still maps.
  const pairs = new Map(); // `${newer}->${older}` -> { newer, older }
  const addPair = (newer, older) => {
    if (!newer || !older || newer === older) return;
    pairs.set(`${newer}->${older}`, { newer, older });
  };
  for (const t of byId.values()) {
    addPair(t.id, field(t.parts.fm, 'supersedes'));
    addPair(field(t.parts.fm, 'superseded_by'), t.id);
  }

  // Plan idempotent mutations per ticket, then write each file at most once.
  const edits = new Map(); // id -> { fm } (mutated frontmatter)
  const fmOf = (t) => (edits.get(t.id) ?? t.parts.fm);
  const changed = [];

  for (const { newer, older } of pairs.values()) {
    const nt = byId.get(newer);
    const ot = byId.get(older);
    // A pointer to a ticket that doesn't exist in the active set is left as-is (could be an
    // archived/cross-scope id); we only write reciprocals between two known active tickets.
    if (!ot) continue;

    if (nt && field(fmOf(nt), 'supersedes') !== older) {
      edits.set(newer, setField(fmOf(nt), 'supersedes', older));
      changed.push(`${newer}.supersedes = ${older} (reciprocal)`);
    }
    if (field(fmOf(ot), 'superseded_by') !== newer) {
      edits.set(older, setField(fmOf(ot), 'superseded_by', newer));
      changed.push(`${older}.superseded_by = ${newer} (reciprocal)`);
    }
    if (field(fmOf(ot), 'status') !== 'superseded') {
      edits.set(older, setField(fmOf(ot), 'status', 'superseded'));
      changed.push(`${older}.status -> superseded`);
    }
  }

  for (const [id, fm] of edits) {
    const t = byId.get(id);
    const out = t.parts.open + fm + t.parts.close + t.parts.rest;
    if (out !== t.text) await writeItemFile(t.path, out);
  }

  return { changed, scanned: byId.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  // Auto-dedup writes supersedes edges for unambiguous duplicates FIRST, then reconcile
  // flips the loser's status + writes the reciprocal pointer through the one KIT-T024 path.
  const dedup = await autoDedupTickets(root);
  for (const c of dedup.changed) process.stdout.write(`auto-dedup: ${c}\n`);
  const { changed, scanned } = await reconcileSupersede(root);
  if (changed.length) {
    process.stdout.write(`reconcile-supersede: scanned ${scanned} ticket(s), ${changed.length} change(s):\n`);
    for (const c of changed) process.stdout.write(`  ${c}\n`);
  } else {
    process.stdout.write(`reconcile-supersede: scanned ${scanned} ticket(s), already consistent.\n`);
  }
}
