#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { git, gitRoot, adopted, projectName, formatWip, watchRepos, readLineage, recordProject, WIP_FILES, WIP_COMMITS } from './lib.mjs';
import { query } from '../scripts/q.mjs';
import { readIdConfig } from '../scripts/id-utils.mjs';

const COMMITS = 12;
const SESSION_LINES = 40;
const ROADMAP_LINES = 50;
const DECISIONS_LINES = 25;

const root = gitRoot();
if (!adopted(root)) process.exit(0);

const firstExisting = (...c) => c.find((f) => existsSync(f)) || null;
const roadmap = firstExisting(join(root, '.ai', 'ROADMAP.md'), join(root, 'ROADMAP.md'));
const decisions = firstExisting(join(root, '.ai', 'DECISIONS.md'), join(root, 'DECISIONS.md'));
const session = join(root, '.ai', 'SESSION.md');

const head = (f, n) => {
  try {
    return readFileSync(f, 'utf8').split('\n').slice(0, n).join('\n');
  } catch {
    return '';
  }
};
const tail = (f, n) => {
  try {
    const l = readFileSync(f, 'utf8').split('\n');
    return l.slice(Math.max(0, l.length - n)).join('\n');
  } catch {
    return '';
  }
};
// Recent decisions when the project uses a decisions/ DIRECTORY (one file per decision)
// rather than a legacy DECISIONS.md. Returns id — title lines for the latest n by id.
const recentDecisions = (n) => {
  let files;
  try {
    files = readdirSync(join(root, '.ai', 'decisions')).filter((f) => f.endsWith('.md') && !/^(README|_TEMPLATE)/i.test(f)).sort();
  } catch {
    return '';
  }
  return files.slice(-n).map((f) => {
    try {
      const t = readFileSync(join(root, '.ai', 'decisions', f), 'utf8');
      const id = (t.match(/^id:[ \t]*(.+)$/m) || [])[1];
      const title = (t.match(/^title:[ \t]*(.+)$/m) || [])[1];
      return `  ${id ? id.trim() + ' — ' : ''}${title ? title.trim() : f.replace(/\.md$/, '')}`;
    } catch {
      return `  ${f.replace(/\.md$/, '')}`;
    }
  }).join('\n');
};

const out = [];
out.push('=== PROJECT ORIENTATION (on-disk record — trust over any summary or your memory) ===');
out.push(`Repo: ${root}`);
out.push('');
out.push('--- Recent commits ---');
out.push(git(['-C', root, 'log', '--oneline', `-${COMMITS}`]).trim());

// Working-tree temperature — uncommitted + unpushed across the project, its data repo
// (the .ai junction target), and any config'd watch_repos. git status/history/push-state
// ARE part of the record: context can clear mid-work, so a resume must see what's not yet
// committed or pushed, anywhere — and reconcile it against the plan, not assume "pushed = all".
//
// Resolve the central data repo (centralized projects: .ai is a junction into it; local
// projects: .ai is in-repo, so this stays null), then self-heal the machine-local registry
// so the cross-project /prime briefing can later find this project's repo on this machine.
let dataRoot = null;
try {
  const ai = join(root, '.ai');
  if (existsSync(ai)) {
    const dr = gitRoot(realpathSync(ai));
    if (dr && realpathSync(dr) !== realpathSync(root)) dataRoot = dr;
  }
} catch {
  /* no .ai junction */
}
recordProject(projectName(root), root, dataRoot);

const repos = [[root, `project (${basename(root)})`]];
if (dataRoot) repos.push([dataRoot, 'data repo (.ai)']);
for (const rel of watchRepos(root)) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) repos.push([abs, `watched: ${basename(abs)}`]);
}
out.push('');
out.push('--- Working tree (uncommitted + unpushed — reconcile vs the plan; the record may lag reality) ---');
for (const [r, label] of repos) out.push(formatWip(label, r, WIP_FILES, WIP_COMMITS));

if (existsSync(session)) {
  out.push('');
  out.push('--- .ai/SESSION.md (working memory — resume here) ---');
  out.push(head(session, SESSION_LINES));
}
if (roadmap) {
  out.push('');
  out.push('--- Plan-of-record (ROADMAP) ---');
  out.push(head(roadmap, ROADMAP_LINES));
}
const decisionsDir = recentDecisions(8);
if (decisionsDir) {
  out.push('');
  out.push('--- Decisions (recent — one file per decision) ---');
  out.push(decisionsDir);
} else if (decisions) {
  out.push('');
  out.push('--- DECISIONS (recent) ---');
  out.push(tail(decisions, DECISIONS_LINES));
}

// Open work, QUERIED from the cross-scope cache instead of opening every ticket file
// (KIT-T026 — the KIT-T020 retrieval win). `query` auto-falls-back to a markdown scan when
// no SQLite engine/DB exists, so this section appears either way; any failure is swallowed
// so a cache hiccup never blocks orientation (fail-open). Items are grouped by scope and
// THIS project's in-flight (doing/review) is called out so a resume sees what's mid-work.
try {
  const { key } = readIdConfig(root);
  const { rows: openRows } = await query('open', [], { cwdRoot: root });
  // scope = the id prefix (KIT from KIT-T049) — same grouping the cache uses, so no extra
  // column is needed and the CLI `open` output shape is untouched.
  const scopeOf = (id) => (String(id).match(/^([A-Za-z]+)-/) || [])[1] || '';
  if (openRows && openRows.length) {
    const inFlight = openRows.filter((r) => scopeOf(r.id) === key && (r.status === 'doing' || r.status === 'review'));
    const byScope = new Map();
    for (const r of openRows) { const s = scopeOf(r.id); byScope.set(s, (byScope.get(s) || 0) + 1); }
    out.push('');
    out.push('--- Open work (QUERIED from the cache; falls back to a scan — see q.mjs) ---');
    out.push('  by scope: ' + [...byScope.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s, n]) => `${s}:${n}`).join('  '));
    if (inFlight.length) {
      out.push(`  in-flight (${key}):`);
      for (const r of inFlight) out.push(`    [${r.status}] ${r.id} — ${r.title}`);
    }
  }
} catch {
  /* cache + fallback both unavailable — orientation proceeds without the open-work view */
}

const lineage = readLineage(root);
if (lineage.length) {
  out.push('');
  out.push('--- Lineage (how this project relates to other repos — trust over memory) ---');
  for (const l of lineage) out.push(`  [${l.role || '?'}] ${l.name}${l.note ? ' — ' + l.note : ''}`);
}
out.push(`
--- IDENTITY & OPERATING MODE (main thread) ---
1. You are the ORCHESTRATOR. Delegate SUBSTANTIAL work — investigation, multi-file
   changes, query sweeps, heavy reads, "is X working?" diagnosis — to subagents with a
   lean, pointer-based brief (ticket id + file:line, never pasted files/tickets); their
   context dies with them. BUT each subagent pays a large fixed baseline regardless of
   task size, so do GENUINELY TINY, well-scoped single-file mechanical edits INLINE, and
   BATCH related small tasks into ONE subagent — never a whole subagent per trivial edit.
   Rule of thumb: if the task's own footprint is smaller than the subagent baseline,
   inline or batch it. "No IC work in the main thread" means no big investigation sweeps
   inline — NOT "never touch a file." The main thread still owns coordination:
   capture/route, dispatch, collect terse summaries, review the diff, build, commit
   citing the ticket, drive the drain.
2. Work order is the drain's job (.ai/config.yml + roadmap + the active \`doing\` ticket),
   not the human's to sequence — pull and dispatch, don't ask "which first?".
3. EVERY question to the human goes through AskUserQuestion — never prose — and ALWAYS
   leads with your recommended option (first in the list, suffixed "(Recommended)").`);
out.push(`
--- PROCESS RULES (enforced by hooks) ---
1. Read the plan-of-record + DECISIONS before non-trivial work. The on-disk record and
   git are AUTHORITATIVE over this summary and over memory; on conflict, reconcile to disk
   and say so.
2. Never assert history/authorship/decisions from memory — read git/.ai or say "I don't know."
3. Log work to a ticket / the plan-of-record, committed in the same change (the gate enforces).
   Record decisions in DECISIONS the turn they happen.
4. Do not start deferred/gated work without the maintainer flipping it.
================================================================================`);
console.log(out.join('\n'));
process.exit(0);
