#!/usr/bin/env node
// begin-task.mjs — programmatic handoff context for a ticket (KIT-T029).
//
// The GOAL: an orchestrator passes a ticket id, not pasted prose. This script assembles
// a self-contained handoff packet — ticket body (description + open criteria + notes),
// governing decisions/origin (q trail), and the item's event history (q doc-trail) — so
// delegation is id-referenced, not context-dump-dependent (KIT-D018).
//
// DEFAULT OUTPUT: compact JSON (machine-parseable, low token count).
// --md: formatted Markdown brief (human-readable, for display or piped into a brief).
//   Chosen because the ticket calls for "low-ingestion" — JSON is the machine-first shape;
//   --md is the human-display escape.
//
//   node scripts/begin-task.mjs <id>         # JSON handoff packet
//   node scripts/begin-task.mjs <id> --md    # Markdown brief
//   node scripts/begin-task.mjs <id> --root <dir>

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { query } from './q.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

// The "pending" marker in acceptance criteria boxes — only open criteria are included in
// the handoff packet (checked criteria are already done; the agent works the open ones).
const OPEN_CRIT_RE = /^\s*-\s*\[ \]\s*(.*)/;

// Hard cap on doc-trail events — the history is evidence, not a narrative dump.
const MAX_HISTORY = 10;

// --- ticket parsing -----------------------------------------------------------------------

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  return { fm: m[1], rest: text.slice(m[0].length) };
}

function scalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// Extract a named section body (the text between `## Heading` and the next `##` or EOF).
// Line-split approach — regex lookahead across `\n` boundaries is unreliable on the
// section-end detection across all Node versions. Returns empty string when absent.
function section(body, heading) {
  const lines = body.split('\n');
  let inSection = false;
  const collected = [];
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (inSection) break; // next heading closes the current section
      if (line.replace(/^##\s+/, '').trim() === heading) { inSection = true; continue; }
    }
    if (inSection) collected.push(line);
  }
  return collected.join('\n').trim();
}

// Collect only the OPEN acceptance criteria (unchecked boxes). Checked criteria are
// already satisfied — the agent only needs to see what remains.
function openCriteria(body) {
  const ac = section(body, 'Acceptance Criteria');
  return ac.split('\n')
    .map((l) => { const m = l.match(OPEN_CRIT_RE); return m ? m[1].trim() : null; })
    .filter(Boolean);
}

// Notes prose (the running commentary the maintainer + previous agents have appended).
function notesProse(body) {
  return section(body, 'Notes');
}

// --- ticket lookup -----------------------------------------------------------------------

function findTicketFile(root, id) {
  const base = join(root, '.ai', 'tickets');
  const dirs = [base, join(base, 'archive')];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f === '_TEMPLATE.md' || f === 'INDEX.md') continue;
      const path = join(dir, f);
      const text = readFileSync(path, 'utf8');
      const parts = splitFrontmatter(text);
      const fid = (parts && scalar(parts.fm, 'id')) || (f.match(/[A-Za-z]+-[A-Za-z]?\d+/) || [])[0];
      if (fid === id) return { path, text, parts };
    }
  }
  return null;
}

// --- q wrappers (both degrade gracefully when cache is absent / query returns nothing) ----

async function getTrail(id, root) {
  try {
    const { rows } = await query('trail', [id], { cwdRoot: root });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return []; // fail-open: a missing/stale cache is not a handoff blocker
  }
}

async function getDocTrail(id, root) {
  try {
    const { rows } = await query('doc-trail', [id], { cwdRoot: root });
    return Array.isArray(rows) ? rows.slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

// --- Markdown brief -----------------------------------------------------------------------

function renderMd(id, meta, description, criteria, notes, trail, history) {
  const lines = [];
  lines.push(`# Handoff brief: ${id}`);
  lines.push('');
  lines.push(`**${meta.title}**  `);
  lines.push(`Status: ${meta.status} · Priority: ${meta.priority} · Type: ${meta.type}`);
  if (meta.links) lines.push(`Links: ${meta.links}`);
  lines.push('');

  if (description) {
    lines.push('## Description');
    lines.push(description);
    lines.push('');
  }

  if (criteria.length) {
    lines.push('## Open Acceptance Criteria');
    for (const c of criteria) lines.push(`- [ ] ${c}`);
    lines.push('');
  }

  if (notes) {
    lines.push('## Notes');
    lines.push(notes);
    lines.push('');
  }

  if (trail.length) {
    lines.push('## Governing trail');
    for (const t of trail) {
      const more = t.more ? ' ✎' : '';
      lines.push(`- **${t.id}** (${t.store}, via ${t.rel}) — ${t.summary}${more}`);
    }
    lines.push('');
  }

  if (history.length) {
    lines.push('## Recent history');
    for (const h of history) lines.push(`- [${h.ts}] ${h.event}: ${h.detail || ''}`);
    lines.push('');
  }

  return lines.join('\n');
}

// --- main ---------------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const md = argv.includes('--md');
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? resolve(argv[ri + 1]) : process.cwd();
  const FLAGS = new Set(['--md', '--root']);
  const positional = argv.filter((a, i) => !FLAGS.has(a) && argv[i - 1] !== '--root');

  const [id] = positional;
  if (!id) {
    process.stderr.write('usage: begin-task.mjs <id> [--md] [--root <dir>]\n');
    process.exit(2);
  }

  const found = findTicketFile(root, id);
  if (!found) {
    process.stderr.write(`begin-task: unknown id '${id}' — no ticket file in ${join(root, '.ai', 'tickets')}\n`);
    process.exit(1);
  }

  const { text, parts } = found;
  if (!parts) {
    process.stderr.write(`begin-task: ${id} has no frontmatter block\n`);
    process.exit(1);
  }

  const meta = {
    id,
    title: scalar(parts.fm, 'title'),
    status: scalar(parts.fm, 'status'),
    priority: scalar(parts.fm, 'priority'),
    type: scalar(parts.fm, 'type'),
    links: scalar(parts.fm, 'links'),
  };

  const description = section(parts.rest, 'Description');
  const criteria = openCriteria(parts.rest);
  const notes = notesProse(parts.rest);

  // q trail + doc-trail run in parallel — both fail-open on a missing engine.
  const [trail, history] = await Promise.all([
    getTrail(id, root),
    getDocTrail(id, root),
  ]);

  if (md) {
    process.stdout.write(renderMd(id, meta, description, criteria, notes, trail, history) + '\n');
    return;
  }

  // Default: compact JSON — the machine-first, low-token shape for orchestrator ingestion.
  const packet = {
    id,
    meta,
    description,
    criteria,      // open (unchecked) only
    notes,
    trail,         // governing decisions/origin (decisions-first, from q trail)
    history,       // most-recent events (from q doc-trail, newest-first, capped)
  };
  process.stdout.write(JSON.stringify(packet, null, 2) + '\n');
}

main().catch((e) => {
  process.stderr.write('begin-task: ' + (e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
});
