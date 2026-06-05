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

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

// Reconcile every ticket under <root>/.ai/tickets (active set only — archived tickets are
// frozen and excluded). Returns { changed: [...descriptions], scanned } so callers can log.
export function reconcileSupersede(root) {
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
    if (out !== t.text) writeFileSync(t.path, out);
  }

  return { changed, scanned: byId.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  const { changed, scanned } = reconcileSupersede(root);
  if (changed.length) {
    process.stdout.write(`reconcile-supersede: scanned ${scanned} ticket(s), ${changed.length} change(s):\n`);
    for (const c of changed) process.stdout.write(`  ${c}\n`);
  } else {
    process.stdout.write(`reconcile-supersede: scanned ${scanned} ticket(s), already consistent.\n`);
  }
}
