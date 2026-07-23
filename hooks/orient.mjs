#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.
// KIT-T071: gist + q-pointer design — essentials inline, big content behind commands.
// Target: ≤1.2k tokens per session (vs ~3.2k before). FAIL-OPEN throughout.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { git, gitRoot, adopted, projectName, formatWip, wipSummary, watchRepos, readLineage, recordProject, aheadBehind, centralDataRoot, globToRegExp, sessionStale, readAgents, partitionAgents, AGENT_STALE_MS, scanStaleDoingTickets, WIP_FILES, WIP_COMMITS } from './lib.mjs';
import { unifyMemory, memoryLinkCommand } from './memory-link.mjs';
// q.mjs / id-utils.mjs are imported DYNAMICALLY at their (try-wrapped) use sites so a
// broken scripts/ tree degrades that one section instead of crashing orientation (KIT-T055).

const COMMITS = 6;
// KIT-T071 per-section budgets (lines):
const SESSION_GIST_LINES = 6;   // first lines of SESSION.md shown inline
const DECISIONS_GIST_LINES = 5; // last N lines of legacy DECISIONS.md shown inline
const DECISIONS_DIR_RECENT = 6; // ids shown from decisions/ directory
const ROADMAP_GIST_LINES = 8;   // first lines of ROADMAP.md shown inline
// KIT-T028: a `doing` ticket with no update for this long is a zombie — flag it prominently.
const ORIENT_DOING_STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
const MENTIONS_SHOWN = 5; // KIT-T130: unread @mentions listed inline before the pointer

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
const lineCount = (f) => {
  try { return readFileSync(f, 'utf8').split('\n').length; } catch { return 0; }
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
    // KIT identity tier: a foundational decision is ALWAYS surfaced (top of orient),
    // never scope-gated — it states what the project fundamentally IS.
    const foundational = /^foundational:[ \t]*(true|yes)\b/im.test(t);
    // A standing decision declares its own relevance: `scope:` (free token, e.g. world-gen)
    // and/or `paths:` (comma globs). This keeps the kit generic — no project taxonomy baked in.
    const scope = stripQuotes((t.match(/^scope:[ \t]*(.+)$/m) || [])[1]);
    const paths = stripQuotes((t.match(/^paths:[ \t]*(.+)$/m) || [])[1])
      .split(',').map((s) => s.trim()).filter(Boolean);
    return { id: id ? id.trim() : '', title: title ? stripQuotes(title) : f.replace(/\.md$/, ''), standing, foundational, scope, paths };
  } catch {
    return { id: '', title: f.replace(/\.md$/, ''), standing: false, foundational: false, scope: '', paths: [] };
  }
};
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
// Recent decisions from a decisions/ DIRECTORY: ids+titles for the latest n, then a pointer.
const recentDecisions = (n) => {
  const files = decisionFiles();
  if (!files) return '';
  const total = files.length;
  const shown = files.slice(-n).map((f) => {
    const { id, title } = decisionMeta(f);
    return `  ${id ? id + ' — ' : ''}${clip(title, 120)}`;
  }).join('\n');
  const more = total > n ? `  +${total - n} more — full: q decisions` : '';
  return shown + (more ? '\n' + more : '');
};
// `paths:` globs use lib's ONE dialect (KIT-T059): `**` any depth, `*` within a segment.
// STANDING decisions are the anti-relitigation backbone — surfaced only when in scope.
const standingDecisions = (signals, changed) => {
  const files = decisionFiles();
  if (!files) return null;
  const all = files.map(decisionMeta).filter((m) => m.standing && !m.foundational);
  if (!all.length) return null;
  const sig = signals.toLowerCase();
  const inScope = (m) => {
    if (!m.scope && !m.paths.length) return true; // global invariant
    if (m.scope && sig.includes(m.scope.toLowerCase())) return true;
    return m.paths.some((g) => { const re = globToRegExp(g); return changed.some((p) => re.test(p)); });
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

// FOUNDATIONAL standing decisions: the project's identity-level invariants — what the
// thing fundamentally IS (e.g. "renderer is Rust/wgpu; three.js is dead"). Unlike scoped
// standing decisions, these are ALWAYS surfaced at the very top, regardless of which files
// you're touching, so a stale CLAUDE.md summary can never quietly override them.
const foundationalDecisions = () => {
  const files = decisionFiles();
  if (!files) return [];
  return files.map(decisionMeta).filter((m) => m.standing && m.foundational);
};

const out = [];
out.push('=== PROJECT ORIENTATION (on-disk record — trust over any summary or your memory) ===');
out.push(`Repo: ${root}`);
out.push('');
const foundational = foundationalDecisions();
if (foundational.length) {
  out.push('--- PROJECT IDENTITY (foundational — ALWAYS true; this is what the project IS; cite, never contradict) ---');
  for (const m of foundational) out.push(`  ${m.id ? m.id + ' — ' : ''}${clip(m.title, 140)}`);
  out.push('');
}
out.push('--- Recent commits ---');
out.push(git(['-C', root, 'log', '--oneline', `-${COMMITS}`]).trim());

// Working-tree temperature — uncommitted + unpushed across the project, its data repo
// (the .ai junction target), and any config'd watch_repos.
const dataRoot = centralDataRoot(root);
recordProject(projectName(root), root, dataRoot);

// KIT-T016 / KIT-D016+D002: ENFORCE the harness-memory⇄committed-memory unification.
const memBanners = [];
try {
  const mem = unifyMemory(root);
  if (mem.action === 'linked') {
    memBanners.push(`!! MEMORY LINK HEALED: ${mem.harnessDir} → ${mem.repoDir} (harness memory was machine-local; now writes to the committed, synced copy).`);
  } else if (mem.action === 'diverged') {
    memBanners.push(`!! MEMORY SPLIT: the harness wrote local memory at ${mem.harnessDir} that DIFFERS from the committed ${mem.repoDir} — reconcile the two, then link: ${memoryLinkCommand(root)}`);
  } else if (mem.action === 'failed') {
    memBanners.push(`!! MEMORY NOT UNIFIED: could not auto-link ${mem.harnessDir} → ${mem.repoDir}; new memory may be machine-local + lost. Link it: ${memoryLinkCommand(root)}`);
  }
} catch {
  /* unification is best-effort — never break orientation */
}

const repos = [[root, `project (${basename(root)})`]];
if (dataRoot) repos.push([dataRoot, 'data repo (.ai)']);
for (const rel of watchRepos(root)) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) repos.push([abs, `watched: ${basename(abs)}`]);
}
out.push('');
out.push('--- Working tree (uncommitted + unpushed) ---');
// KIT-T054: per-repo ahead/behind vs origin. DIVERGED gets a top banner.
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
if (memBanners.length) out.splice(1, 0, ...memBanners);

// KIT-T071: SESSION.md — first SESSION_GIST_LINES inline (resume-point); pointer for the rest.
if (existsSync(session)) {
  out.push('');
  out.push('--- .ai/SESSION.md (resume here — first lines) ---');
  const ss = sessionStale(root);
  if (ss.stale) out.push(`!! SESSION.md is STALE (${ss.sessionDays}d, older than the last commit) — reconcile it to the work below before trusting it.`);
  out.push(head(session, SESSION_GIST_LINES));
  const total = lineCount(session);
  if (total > SESSION_GIST_LINES) out.push(`  … (${total} lines total) — full: read .ai/SESSION.md`);
}

// In-flight + recently-finished DELEGATED AGENTS (KIT-T014).
try {
  const roster = readAgents(root);
  if (roster.length) {
    const { inFlight, finished, stale } = partitionAgents(roster);
    const staleIds = new Set(stale.map((r) => r.id));
    if (inFlight.length || finished.length) {
      out.push('');
      out.push('--- In-flight agents (DELEGATED work — reattach or reconcile) ---');
      const staleMin = Math.round(AGENT_STALE_MS / 60000);
      for (const r of inFlight) {
        const flag = staleIds.has(r.id) ? ` !! UNCOLLECTED (>${staleMin}m, no completion recorded — reattach via TaskList/output or reconcile)` : '';
        out.push(`  [in-flight] ${r.id} (${r.scope || '?'})${r.background ? ' bg' : ''} — ${r.task || '?'}${flag}`);
      }
      for (const r of finished.slice(-3)) {
        out.push(`  [${r.status}] ${r.id} (${r.scope || '?'}) — ${r.task || r.summary || 'finished'} (collect output if not merged)`);
      }
    }
  }
} catch {
  /* roster unavailable — orientation proceeds without the in-flight-agent view */
}

// KIT-T071: ROADMAP — first ROADMAP_GIST_LINES inline; pointer for the rest.
if (roadmap) {
  out.push('');
  out.push('--- Plan-of-record (ROADMAP — current milestone) ---');
  out.push(head(roadmap, ROADMAP_GIST_LINES));
  const total = lineCount(roadmap);
  if (total > ROADMAP_GIST_LINES) out.push(`  … (${total} lines total) — full: head .ai/ROADMAP.md`);
}

// Active signals for standing-decision scope filtering.
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
// KIT-T071: Decisions — id+title gist inline; pointer to full history.
const decisionsDir = recentDecisions(DECISIONS_DIR_RECENT);
if (decisionsDir) {
  out.push('');
  out.push('--- Decisions (recent) ---');
  out.push(decisionsDir);
} else if (decisions) {
  out.push('');
  out.push('--- DECISIONS (recent) ---');
  out.push(tail(decisions, DECISIONS_GIST_LINES));
  const total = lineCount(decisions);
  if (total > DECISIONS_GIST_LINES) out.push(`  … (${total} lines total) — full: tail -n 40 .ai/DECISIONS.md`);
}

// Open work — queried from cache; in-flight (doing/review) for THIS project shown inline.
try {
  const { readIdConfig } = await import('../scripts/id-utils.mjs');
  const { query } = await import('../scripts/q.mjs');
  const { key } = readIdConfig(root);
  const { rows: openRows } = await query('open', [], { cwdRoot: root });
  const scopeOf = (id) => (String(id).match(/^([A-Za-z]+)-/) || [])[1] || '';
  if (openRows && openRows.length) {
    const inFlight = openRows.filter((r) => scopeOf(r.id) === key && (r.status === 'doing' || r.status === 'review'));
    const byScope = new Map();
    for (const r of openRows) { const s = scopeOf(r.id); byScope.set(s, (byScope.get(s) || 0) + 1); }
    out.push('');
    out.push('--- Open work ---');
    out.push('  by scope: ' + [...byScope.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([s, n]) => `${s}:${n}`).join('  '));
    if (inFlight.length) {
      out.push(`  in-flight (${key}):`);
      for (const r of inFlight) out.push(`    [${r.status}] ${r.id} — ${r.title}`);
    }
    out.push(`  drill-in: q open | q trail <id> | q fts <terms>`);
  }
} catch {
  /* cache + fallback both unavailable — orientation proceeds without the open-work view */
}

// KIT-T130: unread @mentions for the acting agent — durable UI/CLI comments a tabula-rasa
// session must pick up without a built context. Acked ones are already cleared. Fail-open.
try {
  const { resolveAgent } = await import('../scripts/comments.mjs');
  const { query } = await import('../scripts/q.mjs');
  const agent = resolveAgent();
  const { rows: mentionRows } = await query('mentions', [agent], { cwdRoot: root });
  const unread = (mentionRows || []).filter((r) => r.state === 'unread');
  if (unread.length) {
    out.push('');
    out.push(`--- UNREAD @${agent} mentions (${unread.length}) — comments addressed to you; ack to clear ---`);
    for (const r of unread.slice(0, MENTIONS_SHOWN)) out.push(`  ${r.ref} [${r.ts}] ${r.from}: ${r.text}`);
    if (unread.length > MENTIONS_SHOWN) out.push(`  +${unread.length - MENTIONS_SHOWN} more — q mentions ${agent}`);
    out.push(`  ack once read: t ack <id>#<n> --agent ${agent}`);
  }
} catch {
  /* mentions surfacing is fail-open — never break orientation */
}

// KIT-T028: stale `doing` detector — zombie banner. Fail-open.
try {
  const sd = scanStaleDoingTickets(root, ORIENT_DOING_STALE_MS);
  if (sd.count) {
    const oldestH = Math.round(sd.oldestMs / 3600000);
    const ids = sd.ids.slice(0, 4).join(', ') + (sd.ids.length > 4 ? ` +${sd.ids.length - 4} more` : '');
    out.push('');
    out.push(`!! ZOMBIE DOING (${sd.count}): ${ids} — stuck \`doing\` >${oldestH}h with no update.`);
    out.push(`   Reconcile: t status <id> todo (if bailed) or review (if done).`);
  }
} catch {
  /* stale-doing scan is fail-open — never block orientation */
}

// KIT-T071: Lineage — one-line gist (count + roles) + pointer; no full dump.
const lineage = readLineage(root);
if (lineage.length) {
  const roles = [...new Set(lineage.map((l) => l.role).filter(Boolean))].sort().join(', ');
  out.push('');
  out.push(`--- Lineage (${lineage.length} relation(s)${roles ? ': ' + roles : ''}) — full: read .ai/lineage.yml ---`);
}

// KIT-T071: GOVERNS — pointer only (count); full list on demand.
// Keeping the governing query (for zombie-ticket surfacing) but collapsing to a pointer.
try {
  const filePaths = changedPaths.filter((p) => /\.[a-z0-9]+$/i.test(p));
  if (filePaths.length) {
    const { query } = await import('../scripts/q.mjs');
    const { rows: govRows } = await query('governing', filePaths, { root, cwdRoot: root });
    const already = new Set([...(standing && standing.shownIds ? standing.shownIds : []), ...foundational.map((m) => m.id).filter(Boolean)]);
    const fresh = (govRows || []).filter((r) => !already.has(r.id));
    if (fresh.length) {
      out.push('');
      out.push(`--- GOVERNS what you're touching: ${fresh.length} item(s) — q governing <path> to inspect ---`);
    }
  }
} catch {
  /* governing query unavailable — orientation proceeds without the file-governance view */
}

out.push(`
--- IDENTITY & PROCESS (main thread) ---
ORCHESTRATOR: delegate substantial work to subagents (lean brief: ticket+file:line, not pasted files).
Inline: genuinely tiny single-file edits. Batch related small tasks into one subagent.
Work order: drain's job (.ai/config.yml + roadmap + active doing ticket) — pull and dispatch.
Questions → AskUserQuestion (never prose), with recommended option first.
QUERY don't grep: q open|governing|trail|fts; code-graph importers-of|defines|surface|duplicate-defines.
PROVENANCE FIRST (KIT-T079): git log -- <path> + code-graph BEFORE any runtime theory.
Read plan-of-record + DECISIONS before non-trivial work. On-disk record and git are AUTHORITATIVE.
Log work to a ticket (gate enforces). Record decisions in DECISIONS the turn they happen.
Full rules: read CLAUDE.md | q governing <hook-file> | code-graph --query surface
================================================================================`);
console.log(out.join('\n'));
process.exit(0);
