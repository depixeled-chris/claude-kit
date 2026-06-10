#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { git, gitRoot, adopted, projectName, formatWip, wipSummary, watchRepos, readLineage, recordProject, aheadBehind, WIP_FILES, WIP_COMMITS } from './lib.mjs';
// q.mjs / id-utils.mjs are imported DYNAMICALLY at their (try-wrapped) use sites so a
// broken scripts/ tree degrades that one section instead of crashing orientation (KIT-T055).

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
const decisionFiles = () => {
  try {
    return readdirSync(join(root, '.ai', 'decisions')).filter((f) => f.endsWith('.md') && !/^(README|_TEMPLATE)/i.test(f)).sort();
  } catch {
    return null;
  }
};
const stripQuotes = (s) => (s || '').trim().replace(/^["']|["']$/g, '').trim();
const decisionMeta = (f) => {
  try {
    const t = readFileSync(join(root, '.ai', 'decisions', f), 'utf8');
    const id = (t.match(/^id:[ \t]*(.+)$/m) || [])[1];
    const title = (t.match(/^title:[ \t]*(.+)$/m) || [])[1];
    const standing = /^standing:[ \t]*(true|yes)\b/im.test(t);
    // A standing decision declares its own relevance: `scope:` (free token, e.g. world-gen)
    // and/or `paths:` (comma globs). This keeps the kit generic — no project taxonomy baked in.
    const scope = stripQuotes((t.match(/^scope:[ \t]*(.+)$/m) || [])[1]);
    const paths = stripQuotes((t.match(/^paths:[ \t]*(.+)$/m) || [])[1])
      .split(',').map((s) => s.trim()).filter(Boolean);
    return { id: id ? id.trim() : '', title: title ? stripQuotes(title) : f.replace(/\.md$/, ''), standing, scope, paths };
  } catch {
    return { id: '', title: f.replace(/\.md$/, ''), standing: false, scope: '', paths: [] };
  }
};
// Recent decisions when the project uses a decisions/ DIRECTORY (one file per decision)
// rather than a legacy DECISIONS.md. Returns id — title lines for the latest n by id.
const recentDecisions = (n) => {
  const files = decisionFiles();
  if (!files) return '';
  return files.slice(-n).map((f) => {
    const { id, title } = decisionMeta(f);
    return `  ${id ? id + ' — ' : ''}${clip(title, 120)}`;
  }).join('\n');
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const globToRe = (g) => new RegExp('^' + g.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
// STANDING decisions are the anti-relitigation backbone — settled calls that must never be
// re-asked. But surfacing ALL of them every session is unsustainable + wasteful, so they are
// SCOPE-FILTERED: a standing decision shows only when it pertains to what this session is
// actually touching. Relevance = its `scope` token appears in the active signals (changed
// files + recent commit subjects) OR a `paths:` glob matches a changed file OR it declares no
// scope (a truly global invariant — keep those rare). Out-of-scope standing decisions collapse
// to a one-line pointer so they're discoverable without dumping the pile.
const standingDecisions = (signals, changed) => {
  const files = decisionFiles();
  if (!files) return null;
  const all = files.map(decisionMeta).filter((m) => m.standing);
  if (!all.length) return null;
  const sig = signals.toLowerCase();
  const inScope = (m) => {
    if (!m.scope && !m.paths.length) return true; // global invariant
    if (m.scope && sig.includes(m.scope.toLowerCase())) return true;
    return m.paths.some((g) => { const re = globToRe(g); return changed.some((p) => re.test(p)); });
  };
  const shown = all.filter(inScope);
  const deferred = all.filter((m) => !inScope(m));
  const deferredScopes = [...new Set(deferred.map((m) => m.scope).filter(Boolean))].sort();
  return {
    shown: shown.map((m) => `  ${m.id ? m.id + ' — ' : ''}${clip(m.title, 120)}`).join('\n'),
    shownIds: shown.map((m) => m.id).filter(Boolean),
    deferredCount: deferred.length,
    deferredScopes,
  };
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
// KIT-T054: per-repo ahead/behind vs origin (bounded fetch, fail-open offline). DIVERGED
// means two machines hold history the other lacks — the case that produced a mid-task
// merge conflict; it gets a banner at the very top, not a buried line.
const divergedLabels = [];
for (const [r, label] of repos) {
  out.push(formatWip(label, r, WIP_FILES, WIP_COMMITS));
  const ab = aheadBehind(r, { fetch: true });
  if (ab && (ab.behind || ab.diverged)) {
    out.push(`  vs origin: ahead ${ab.ahead} / behind ${ab.behind}${ab.diverged ? ' — DIVERGED' : ''}`);
    if (ab.diverged) divergedLabels.push(label);
  }
}
if (divergedLabels.length) {
  out.splice(1, 0, `!! DIVERGED FROM ORIGIN: ${divergedLabels.join(', ')} — fetch + rebase BEFORE working; two machines hold different history.`);
}

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
// Active signals = what this session is touching: changed file paths (project + data repo)
// plus recent commit subjects. Standing decisions are filtered against this so only the
// relevant ones surface (scope-based, not the whole pile).
// Parse a `git status --porcelain` line to its path. The XY status is 1-2 chars then
// whitespace; a fixed slice(3) corrupts the path when the block-level trim ate a leading
// space (` M f` vs `M  f`), so strip the status+space run by regex. A rename (`R old -> new`)
// reports the NEW path. This exactness matters now that `q governing` matches paths literally.
const porcelainPath = (l) => {
  const m = String(l).match(/^\s*\S{1,2}\s+(.*)$/);
  const p = (m ? m[1] : l).trim();
  const arrow = p.split(' -> ');
  return (arrow.length > 1 ? arrow[1] : p).replace(/^["']|["']$/g, '');
};
const changedPaths = [];
for (const [r] of repos) {
  try { for (const l of wipSummary(r).dirty) { const p = porcelainPath(l); if (p) changedPaths.push(p); } } catch { /* skip */ }
}
const recentSubjects = git(['-C', root, 'log', '--oneline', `-${COMMITS}`]) || '';
const activeSignals = changedPaths.join(' ') + ' ' + recentSubjects;
const standing = standingDecisions(activeSignals, changedPaths);
if (standing && (standing.shown || standing.deferredCount)) {
  out.push('');
  out.push('--- STANDING decisions in scope (settled — CITE, never re-ask or relitigate) ---');
  if (standing.shown) out.push(standing.shown);
  if (standing.deferredCount) {
    const scopes = standing.deferredScopes.length ? ` (scopes: ${standing.deferredScopes.join(', ')})` : '';
    out.push(`  +${standing.deferredCount} more standing decision(s) out of scope${scopes} — check before deciding in those areas (q decisions).`);
  }
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
  const { readIdConfig } = await import('../scripts/id-utils.mjs');
  const { query } = await import('../scripts/q.mjs');
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

// GOVERNS what you're touching (KIT-T049) — the inverse of `q trail`. For the working tree's
// currently-changed files, surface the OPEN tickets + in-force decisions that GOVERN them
// (ticket `files:` / decision `scope`/`paths`), so a captured item that owns these exact files
// can't stay invisible while they're worked (the HOD-T048 failure: it sat `todo` while its
// governed files were edited and nothing surfaced it). Single-scope (root) — only THIS
// project's items govern its own tree. Deduped against the standing decisions already shown
// above (no point listing HOD-D015 twice). Fail-open: any error is swallowed.
try {
  const filePaths = changedPaths.filter((p) => /\.[a-z0-9]+$/i.test(p)); // files, not bare dirs
  if (filePaths.length) {
    const { query } = await import('../scripts/q.mjs');
    const { rows: govRows } = await query('governing', filePaths, { root, cwdRoot: root });
    const already = new Set(standing && standing.shownIds ? standing.shownIds : []);
    const fresh = (govRows || []).filter((r) => !already.has(r.id));
    if (fresh.length) {
      out.push('');
      out.push('--- GOVERNS what you\'re touching (open — address or cite; q governing <path>) ---');
      for (const r of fresh) {
        out.push(`  [${r.store === 'decisions' ? 'decision' : r.status}] ${r.id} — ${r.summary}${r.more ? ' ' + r.more : ''}  (matched: ${r.matched})`);
      }
    }
  }
} catch {
  /* governing query unavailable — orientation proceeds without the file-governance view */
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
   leads with your recommended option (first in the list, suffixed "(Recommended)").
4. Keep replies SHORT and skimmable. Lead with the outcome; cut preamble/recap. List more
   than ~2 items as bullets, never a prose paragraph. No walls of text — a few tight lines
   beat a dense block. The human is tracking many threads; respect their attention.`);
out.push(`
--- PROCESS RULES (enforced by hooks) ---
1. QUERY, don't grep. For work/issues/history use \`q\` (q open | governing <path> | trail <id>
   | fts <terms> | doc-trail <id>); for code use \`code-graph --query\` (importers-of | defines
   | surface). They see links/graph a raw grep can't. The query-gate BLOCKS grepping the .ai
   store and tree-wide source greps. Grep is fine only for a SPECIFIC known file (use Grep/Glob/Read).
2. Read the plan-of-record + DECISIONS before non-trivial work. The on-disk record and
   git are AUTHORITATIVE over this summary and over memory; on conflict, reconcile to disk
   and say so.
3. Never assert history/authorship/decisions from memory — read git/.ai or say "I don't know."
4. Log work to a ticket / the plan-of-record, committed in the same change (the gate enforces).
   Record decisions in DECISIONS the turn they happen.
5. Do not start deferred/gated work without the maintainer flipping it.
================================================================================`);
console.log(out.join('\n'));
process.exit(0);
