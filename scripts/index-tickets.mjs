#!/usr/bin/env node
// Regenerate the ticket reference files from the ticket markdown (DECISIONS D-006).
// Tickets are the truth; these files are GENERATED — never hand-edit them.
//   .ai/tickets/INDEX.md  — the board: every ticket (id, type, status, priority, title)
//   .ai/SUPERSEDED.md     — supersede chains (older -> newer replacement), longest first.
//   .ai/REGRESSIONS.md    — bug/regression chains (original -> recurrences), longest
//                           first, with the causing/fixing commits.
//
//   node scripts/index-tickets.mjs [repoRoot]   # defaults to cwd
//
// regenerateIndexes(root) is the importable entry point (KIT-T063): the PostToolUse ingest
// hook calls it directly when a hand-edit lands a ticket file, so the board no longer rots
// waiting for someone to remember this script. CLI execution is guarded below so the import
// has no side effects.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareIds } from './id-utils.mjs';
import { query } from './q.mjs';
import { reconcileSupersede, autoDedupTickets } from './reconcile-supersede.mjs';

const SKIP = new Set(['_TEMPLATE.md', 'INDEX.md']);

// A frontmatter scalar, with the YAML inline comment stripped. A blank template line
// (`superseded_by:            # ticket id that retired THIS one`) must read as EMPTY, not as
// its trailing placeholder comment (KIT-T063) — otherwise a never-replaced superseded ticket
// rendered the comment text in the "superseded by" column. The strip fires on a `#` that
// begins the value or follows whitespace (the YAML inline-comment convention), so a `#` that is
// part of an unspaced real value is preserved.
function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return '';
  return m[1].replace(/(^|\s)#.*$/, '').trim().replace(/^["']|["']$/g, '');
}

// Tolerant inline-list parse — `aka: [R045, R046]` or `aka: []` -> string[].
// Mirrors the `list()` idiom in db-parse.mjs (no dep, no YAML library).
function listField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return [];
  const raw = m[1].replace(/(^|\s)#.*$/, '').trim();
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

function readTickets(dir, archived) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && !SKIP.has(f))
    .map((f) => {
      const fm = (readFileSync(join(dir, f), 'utf8').match(/^---\n([\s\S]*?)\n---/) || [null, ''])[1];
      const id = field(fm, 'id') || (f.match(/[A-Za-z]+-\d+/) || [])[0] || f.replace(/\.md$/, '');
      return {
        id,
        archived,
        title: field(fm, 'title') || id,
        type: field(fm, 'type') || '—',
        status: field(fm, 'status') || '—',
        priority: field(fm, 'priority') || '—',
        milestone: field(fm, 'milestone'),
        aka: listField(fm, 'aka'),
        parent: field(fm, 'parent'),
        regressedFrom: field(fm, 'regressed_from'),
        causingCommit: field(fm, 'causing_commit'),
        fixedCommit: field(fm, 'fixed_commit'),
        supersedes: field(fm, 'supersedes'),
        supersededBy: field(fm, 'superseded_by'),
        // provenance fields (KIT-T095)
        introducedBy: field(fm, 'introduced_by'),
        producedBy: field(fm, 'produced_by'),
        informs: listField(fm, 'informs'),
      };
    });
}

// Light, dependency-free read of the two config bits the ROADMAP view needs.
function readRoadmapConfig(root) {
  let mode = 'narrative'; // safe default: never overwrite ROADMAP unless opted in
  let priorities = ['critical', 'high', 'medium', 'low'];
  try {
    const cfg = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
    const mm = cfg.match(/roadmap_mode:[ \t]*(\w+)/);
    if (mm) mode = mm[1];
    const pm = cfg.match(/priorities:[ \t]*\[([^\]]+)\]/);
    if (pm) priorities = pm[1].split(',').map((s) => s.trim());
  } catch {
    /* defaults */
  }
  return { mode, priorities };
}

// Regenerate INDEX.md / SUPERSEDED.md / REGRESSIONS.md (and ROADMAP.md when generated) under
// <root>/.ai from the ticket markdown. Returns a one-line-able summary, or throws on a hard
// fault (duplicate ids) so the CLI can exit non-zero. Callers that must never wedge (the
// PostToolUse hook) wrap this in their own try/catch.
export async function regenerateIndexes(root) {
  const { mode: roadmapMode, priorities } = readRoadmapConfig(root);

  // Auto-dedup UNAMBIGUOUS ticket duplicates (KIT-T025, locked policy C; KIT-D021: automate >
  // remembered-manual) BEFORE reconcile: same-scope tickets with an IDENTICAL normalized title
  // that the KIT-T024 detector also confirms get a `supersedes` edge written (survivor = lower
  // id). Tickets ONLY — decisions/notes/questions stay suggest-only. Strict + idempotent.
  const dedup = await autoDedupTickets(root);
  for (const c of dedup.changed) process.stdout.write(`auto-dedup: ${c}\n`);

  // Auto-reconcile supersede relationships in the markdown BEFORE reading the board (KIT-D021):
  // a one-sided `supersedes:`/`superseded_by:` declaration (including the edges auto-dedup just
  // wrote) gets its reciprocal pointer written and the retired ticket flipped to `status:
  // superseded`. Idempotent + safe (only flips TO superseded). This is the deterministic,
  // automatic home — it already runs to rebuild the board, writes markdown, and is OUT of the
  // PreToolUse/commit hot path.
  const recon = reconcileSupersede(root);
  for (const c of recon.changed) process.stdout.write(`reconcile-supersede: ${c}\n`);

  const ticketsDir = join(root, '.ai', 'tickets');
  const archiveDir = join(ticketsDir, 'archive');

  const tickets = [...readTickets(ticketsDir, false), ...readTickets(archiveDir, true)];

  // Fail loud on duplicate ids instead of silently last-write-wins — a collision (two
  // files sharing an id) must never generate quietly.
  const idCounts = new Map();
  for (const t of tickets) idCounts.set(t.id, (idCounts.get(t.id) || 0) + 1);
  const dupIds = [...idCounts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  if (dupIds.length) {
    throw new Error(
      `index-tickets: DUPLICATE ticket id(s): ${dupIds.join(', ')}. ` +
        `Re-key one (scripts/next-id.mjs tickets) before regenerating.`,
    );
  }

  // --- INDEX.md: the board ---
  // A superseded ticket (status `superseded` OR carrying a `superseded_by` pointer) drops out of
  // the ACTIVE board into its own section, so a retired duplicate never shows as live work
  // (KIT-T024). Same predicate the drain's `open` query uses — one definition of "active".
  const isSuperseded = (t) => t.status === 'superseded' || !!t.supersededBy;
  const HEADER = '| id | type | status | priority | title |\n| --- | --- | --- | --- | --- |';
  const SUP_HEADER = '| id | status | title | superseded by |\n| --- | --- | --- | --- |';
  const active = tickets.filter((t) => !t.archived && !isSuperseded(t));
  const archived = tickets.filter((t) => t.archived);
  const superseded = tickets.filter((t) => !t.archived && isSuperseded(t));

  // Build reverse indexes (one pass, graceful on dangling refs — skip silently, no crash).
  const knownIds = new Set(tickets.map((t) => t.id));

  // parent id → child items (KIT-T094)
  const childrenByParent = new Map();
  // source id → items it produced (KIT-T095: produced_by reverse)
  const producedBySource = new Map();
  // target id → items that inform it (KIT-T095: informs reverse)
  const informsTarget = new Map();

  for (const t of tickets) {
    if (t.parent && knownIds.has(t.parent)) {
      const kids = childrenByParent.get(t.parent) || [];
      kids.push(t.id);
      childrenByParent.set(t.parent, kids);
    }
    // dangling parent: skip silently — no crash.

    if (t.producedBy && knownIds.has(t.producedBy)) {
      const produced = producedBySource.get(t.producedBy) || [];
      produced.push(t.id);
      producedBySource.set(t.producedBy, produced);
    }
    // dangling produced_by: skip silently — no crash.

    for (const targetId of t.informs) {
      if (knownIds.has(targetId)) {
        const informed = informsTarget.get(targetId) || [];
        informed.push(t.id);
        informsTarget.set(targetId, informed);
      }
      // dangling informs ref: skip silently — no crash.
    }
  }

  // Row-building helpers — defined after the reverse-index pass so tag helpers can reference it.
  const akaTag = (t) => t.aka && t.aka.length ? ` · was ${t.aka.join(', ')}` : '';
  const parentTag = (t) => t.parent ? ` ↳ ${t.parent}` : '';
  // Upward marker: this item was produced by a source doc (KIT-T095).
  const producedByTag = (t) => t.producedBy ? ` ← produced_by ${t.producedBy}` : '';
  const row = (t) => `| ${t.id} | ${t.type} | ${t.status} | ${t.priority} | ${t.title}${akaTag(t)}${parentTag(t)}${producedByTag(t)} |`;
  const supRow = (t) => `| ${t.id} | ${t.status} | ${t.title}${akaTag(t)}${parentTag(t)}${producedByTag(t)} | ${t.supersededBy || '—'} |`;

  const childrenRollup = (t) => {
    const kids = childrenByParent.get(t.id);
    return kids && kids.length ? `\n|  | | | | ↳ children: ${kids.join(', ')} |` : '';
  };
  // Downward rollup from a source item: what it produced + what it informs (KIT-T095).
  const provenanceDownRollup = (t) => {
    const lines = [];
    const produced = producedBySource.get(t.id);
    if (produced && produced.length) lines.push(`\n|  | | | | ↳ produced: ${produced.join(', ')} |`);
    const informs = informsTarget.get(t.id);
    if (informs && informs.length) lines.push(`\n|  | | | | ↳ informs: ${informs.join(', ')} |`);
    return lines.join('');
  };

  const rowWithRollup = (t) => row(t) + childrenRollup(t) + provenanceDownRollup(t);

  const indexMd = [
    '<!-- GENERATED by scripts/index-tickets.mjs — do not hand-edit. Tickets are the truth. -->',
    '# Ticket board',
    '',
    `## Active (${active.length})`,
    HEADER,
    ...active.map(rowWithRollup),
    '',
    `## Superseded (${superseded.length})`,
    SUP_HEADER,
    ...superseded.map(supRow),
    '',
    `## Archived (${archived.length})`,
    HEADER,
    ...archived.map(rowWithRollup),
    '',
  ].join('\n');
  writeFileSync(join(ticketsDir, 'INDEX.md'), indexMd);

  // --- REGRESSIONS.md: chains linked by regressed_from (linear; longest first) ---
  // Regression provenance (regressed_from + causing/fixed commits) is READ FROM THE CACHE
  // via q.mjs's canned `regressions` query (KIT-T026); it fails open to the markdown the
  // script already loaded, so the cache is never a hard dependency. `query` returns the
  // same per-id rows from either path (cache or db-parse scan) — parity lives in q.mjs.
  async function regressionData() {
      try {
      const { rows } = await query('regressions', [], { root });
      const m = new Map();
      for (const r of rows) {
        m.set(r.id, { regressedFrom: r.regressed_from || '', causingCommit: r.causing_commit || '', fixedCommit: r.fixed_commit || '', introducedBy: r.introduced_by || '' });
      }
      if (m.size) return m;
    } catch {
      /* fall through to the markdown scan the script already performed */
    }
    return new Map(tickets.map((t) => [t.id, { regressedFrom: t.regressedFrom, causingCommit: t.causingCommit, fixedCommit: t.fixedCommit, introducedBy: t.introducedBy }]));
  }
  const reg = await regressionData();
  // `introduced_by` is not in the canned `regressions` SQL query (it's a new field).
  // Overlay it from the already-parsed markdown tickets so it's always available even
  // when the cache path is used (the markdown parse is authoritative for new fields).
  const ticketById = new Map(tickets.map((t) => [t.id, t]));
  for (const [id, entry] of reg) {
    if (!entry.introducedBy) {
      const t = ticketById.get(id);
      if (t && t.introducedBy) entry.introducedBy = t.introducedBy;
    }
  }

  const recurrences = tickets.filter((t) => reg.get(t.id)?.regressedFrom);
  const childrenOf = new Map();
  for (const t of recurrences) {
    const from = reg.get(t.id).regressedFrom;
    const kids = childrenOf.get(from) || [];
    kids.push(t.id);
    childrenOf.set(from, kids);
  }
  const isChild = new Set(recurrences.map((t) => t.id));
  const roots = [...childrenOf.keys()].filter((id) => !isChild.has(id));

  function chainFrom(rootId) {
    const out = [rootId];
    let kids = childrenOf.get(rootId) || [];
    while (kids.length) {
      out.push(kids[0]);
      kids = childrenOf.get(kids[0]) || [];
    }
    return out;
  }

  const commitNote = (id) => {
    const r = reg.get(id);
    const bits = [];
    if (r && r.introducedBy) bits.push(`introduced by ${r.introducedBy}`);
    if (r && r.causingCommit) bits.push(`caused by ${r.causingCommit}`);
    if (r && r.fixedCommit) bits.push(`fixed in ${r.fixedCommit}`);
    return bits.length ? ` (${bits.join('; ')})` : '';
  };

  const chains = roots.map(chainFrom).sort((a, b) => b.length - a.length);
  const regLines = chains.length
    ? chains.map((c) => `- ${c.map((id) => `**${id}**${commitNote(id)}`).join('  →  ')}  · ${c.length} occurrence(s)`)
    : ['_No regressions linked yet._'];

  const regMd = [
    '<!-- GENERATED by scripts/index-tickets.mjs — do not hand-edit. -->',
    '# Regressions',
    '',
    'Chains of `original → recurrence`, longest first (repeat offenders at the top). A',
    'recurrence is a `type: regression` ticket with `regressed_from:` set.',
    '',
    ...regLines,
    '',
  ].join('\n');
  writeFileSync(join(root, '.ai', 'REGRESSIONS.md'), regMd);

  // --- SUPERSEDED.md: chains linked by supersedes (older -> newer; KIT-T024) ---
  // Supersede provenance is READ FROM THE CACHE via q.mjs's `supersedes` query (KIT-T026 pattern),
  // failing open to the markdown the script already loaded. An edge is newer→older (`supersedes`);
  // we invert it to render the human-readable older→newer "retired by" chain, like REGRESSIONS.
  async function supersedeData() {
    try {
      const { rows } = await query('supersedes', [], { root });
      if (rows.length) return new Map(rows.map((r) => [r.id, r.supersedes || '']));
    } catch {
      /* fall through to the markdown scan */
    }
    return new Map(tickets.map((t) => [t.id, t.supersedes || '']));
  }
  const sup = await supersedeData();
  const supersedesOf = new Map([...sup].filter(([, to]) => to)); // newer -> older
  const olderToNewer = new Map();
  for (const [newer, older] of supersedesOf) olderToNewer.set(older, newer);
  const supRoots = [...olderToNewer.keys()].filter((id) => !supersedesOf.has(id)); // never itself superseded
  function supChainFrom(rootId) {
    const out = [rootId];
    let next = olderToNewer.get(rootId);
    while (next) {
      out.push(next);
      next = olderToNewer.get(next);
    }
    return out;
  }
  const supChains = supRoots.map(supChainFrom).sort((a, b) => b.length - a.length);
  const supLines = supChains.length
    ? supChains.map((c) => `- ${c.map((id) => `**${id}**`).join('  →  ')}  · ${c.length - 1} superseded`)
    : ['_No superseded tickets yet._'];
  const supMd = [
    '<!-- GENERATED by scripts/index-tickets.mjs — do not hand-edit. -->',
    '# Superseded',
    '',
    'Chains of `older → newer`, the rightmost id being the live replacement. A ticket is',
    'superseded when a newer one sets `supersedes:` (or it carries `superseded_by:` / status',
    '`superseded`); superseded tickets are dropped from the active board + drain.',
    '',
    ...supLines,
    '',
  ].join('\n');
  writeFileSync(join(root, '.ai', 'SUPERSEDED.md'), supMd);

  // --- ROADMAP.md: thin sequenced index, GENERATED from ticket frontmatter ---
  // Only when config roadmap_mode=generated; a narrative ROADMAP is left untouched
  // (so a hand-curated one isn't clobbered before its items are ticketed).
  let roadmapNote = 'ROADMAP.md left as-is (narrative mode)';
  if (roadmapMode === 'generated') {
    const open = active.filter((t) => t.status !== 'done'); // `active` already drops superseded
    const prio = (t) => {
      const i = priorities.indexOf(t.priority);
      return i < 0 ? priorities.length : i;
    };
    const bySeq = (a, b) => prio(a) - prio(b) || compareIds(a.id, b.id);
    const milestones = [...new Set(open.filter((t) => t.milestone).map((t) => t.milestone))];
    const lines = [
      '<!-- GENERATED by scripts/index-tickets.mjs — do not hand-edit. Tickets are the truth. -->',
      '# Roadmap',
      '',
    ];
    for (const m of milestones) {
      const items = open.filter((t) => t.milestone === m).sort(bySeq);
      lines.push(`## ${m}`, ...items.map((t, i) => `${i + 1}. ${t.id} — ${t.title} (${t.status})`), '');
    }
    const backlog = open.filter((t) => !t.milestone).sort(bySeq);
    if (backlog.length) {
      lines.push('## Backlog (priority order)', ...backlog.map((t) => `- ${t.id} — ${t.title} (${t.priority})`), '');
    }
    writeFileSync(join(root, '.ai', 'ROADMAP.md'), lines.join('\n'));
    roadmapNote = `ROADMAP.md generated (${milestones.length} milestone(s), ${backlog.length} backlog)`;
  }

  return {
    active: active.length,
    superseded: superseded.length,
    archived: archived.length,
    regChains: chains.length,
    supChains: supChains.length,
    roadmapNote,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] || process.cwd();
  regenerateIndexes(root)
    .then((r) => {
      process.stdout.write(
        `Wrote .ai/tickets/INDEX.md (${r.active} active, ${r.superseded} superseded, ${r.archived} archived), ` +
          `.ai/REGRESSIONS.md (${r.regChains} chain(s)), .ai/SUPERSEDED.md (${r.supChains} chain(s)); ${r.roadmapNote}.\n`,
      );
    })
    .catch((e) => {
      process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
      process.exit(1);
    });
}
