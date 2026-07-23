#!/usr/bin/env node
// survey.mjs — the data gatherer behind /prime (T-001).
//
//   node scripts/survey.mjs                 -> LAZY cross-project briefing ("what needs me?")
//   node scripts/survey.mjs <name> [name…]  -> DEEP resume of the named project(s)
//
// Serves two readers at once: a freshly-wiped Claude and a human whose memory has faded.
// The no-arg briefing leads with what's WAITING ON THE MAINTAINER (review tickets, open
// questions, SESSION "needs you" flags) across every tracked project, then a one-line status
// per project, then a deep view of only the ACTIVE project (the repo this ran in) — lazy by
// design. Naming projects switches to a full deep view of just those.
//
// Project locations come from the machine-local registry (hooks/lib.mjs), self-healed by
// orient. Notebooks read from the synced .ai data; git temperature read from the repo path
// known on THIS machine (projects not opened here show notebook-only, flagged).
//
// The discovery + notebook readers are EXPORTED (KIT-T131): the web-UI API's waiting board
// reuses discoverProjects/scan/needsBlock by import rather than re-deriving them, so the CLI
// briefing and the API answer from ONE scan. CLI execution is guarded by isMain so the import
// has no side effects (no console output, no registry self-heal).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  gitRoot, adopted, projectName, readRegistry, recordProject,
  formatWip, watchRepos, wipSummary, WIP_FILES, WIP_COMMITS,
} from '../hooks/lib.mjs';

const OPEN_STATUSES = ['todo', 'doing', 'review'];
const SESSION_PEEK = 28; // lines of SESSION.md shown in a deep view
const NEEDS_MAX = 6; // "needs you" lines surfaced per project before truncating
const TITLE_MAX = 80; // ticket title clip

// Read a project's config.yml and return true when it contains `lab: true`.
// Tolerant scan — no YAML parser needed; a bare `^lab:\s*true` line is sufficient.
export function readLabFlag(notebook) {
  try {
    const text = readFileSync(join(notebook, 'config.yml'), 'utf8');
    return /^lab:\s*true\s*$/m.test(text);
  } catch {
    return false;
  }
}

// Discover every known project: registry entries (repo + its in-repo/junctioned .ai) plus any
// central data project not yet opened on this machine (notebook-only). `cwdRoot` names the
// ACTIVE project (the repo this ran in) so it is always included even before the registry
// self-heals. PURE read — never writes the registry (the self-heal lives in the CLI main),
// so an API importer discovers the same set without a side effect. Returns
// { projects: { name -> { repo, notebook, lab } }, activeName }.
export function discoverProjects(cwdRoot = gitRoot()) {
  const activeName = cwdRoot && adopted(cwdRoot) ? projectName(cwdRoot) : null;
  const reg = readRegistry();
  const centralNames = () => {
    if (!reg.dataRoot) return [];
    try {
      return readdirSync(join(reg.dataRoot, 'projects'), { withFileTypes: true })
        .filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      return [];
    }
  };
  const names = new Set([...Object.keys(reg.projects), ...centralNames()]);
  if (activeName) names.add(activeName);

  const projects = {};
  for (const name of names) {
    let repo = reg.projects[name] && existsSync(reg.projects[name]) ? reg.projects[name] : null;
    if (!repo && name === activeName) repo = cwdRoot;
    let notebook = repo && existsSync(join(repo, '.ai')) ? join(repo, '.ai') : null;
    if (!notebook && reg.dataRoot) {
      const central = join(reg.dataRoot, 'projects', name);
      if (existsSync(central)) notebook = central;
    }
    if (notebook) projects[name] = { repo, notebook, lab: readLabFlag(notebook) };
  }
  return { projects, activeName };
}

// ---- notebook readers -----------------------------------------------------
function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const f = line.match(/^([a-zA-Z_]+):[ \t]*(.*)$/);
      if (f) fm[f[1]] = f[2].trim();
    }
  }
  return fm;
}
const GENERATED = new Set(['INDEX.md', 'REGRESSIONS.md', 'ROADMAP.md']);
export function readTickets(notebook) {
  const dir = join(notebook, 'tickets');
  let files;
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_') && !GENERATED.has(f));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      const fm = frontmatter(readFileSync(join(dir, f), 'utf8'));
      const title = (fm.title || '').replace(/^["']|["']$/g, '').slice(0, TITLE_MAX);
      out.push({ id: fm.id || f.replace(/\.md$/, ''), title, status: fm.status || 'todo', priority: fm.priority || '' });
    } catch {
      /* unreadable ticket — skip */
    }
  }
  return out;
}
export function openQuestions(notebook) {
  try {
    return readdirSync(join(notebook, 'questions'))
      .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
      .map((f) => f.replace(/\.md$/, ''));
  } catch {
    return [];
  }
}
// Lines under a SESSION.md heading that names the maintainer ("NEEDS CHRIS", "waiting on
// you", "needs review/decision/approval") — the prose escape hatch for action items that
// aren't yet structured as review-tickets or questions.
export function needsBlock(notebook) {
  let text;
  try {
    text = readFileSync(join(notebook, 'SESSION.md'), 'utf8');
  } catch {
    return [];
  }
  const items = [];
  let capturing = false;
  for (const line of text.split('\n')) {
    if (/^#{1,6}\s/.test(line)) {
      capturing = /needs?\s+(you|chris|maintainer|review|decision|approval)/i.test(line);
      continue;
    }
    if (!capturing) continue;
    const t = line.trim();
    if (!t) continue;
    if (/^[-*]\s/.test(t) || !items.length) items.push(t.replace(/^[-*]\s*/, ''));
    else items[items.length - 1] += ' ' + t; // wrapped continuation of the current bullet
  }
  return items.slice(0, NEEDS_MAX);
}
export function scan(notebook) {
  const tickets = readTickets(notebook);
  const open = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const counts = { doing: 0, review: 0, todo: 0 };
  for (const t of open) if (counts[t.status] !== undefined) counts[t.status]++;
  return {
    open,
    counts,
    review: tickets.filter((t) => t.status === 'review'),
    questions: openQuestions(notebook),
    needs: needsBlock(notebook),
  };
}
const headFile = (f, n) => {
  try {
    return readFileSync(f, 'utf8').split('\n').slice(0, n).join('\n');
  } catch {
    return '';
  }
};
function gitOneLine(repo) {
  const s = wipSummary(repo);
  const parts = [];
  if (s.dirty.length) parts.push(`${s.dirty.length} uncommitted`);
  if (s.unpushed.length) parts.push(`${s.unpushed.length} unpushed`);
  for (const rel of watchRepos(repo)) {
    const abs = resolve(repo, rel);
    if (!existsSync(abs)) continue;
    const w = wipSummary(abs);
    if (!w.clean) parts.push(`${basename(abs)}: ${w.dirty.length} uncommitted, ${w.unpushed.length} unpushed`);
  }
  return parts.length ? parts.join('; ') : 'clean + pushed';
}

// ---- views ----------------------------------------------------------------
function deepView(name, p) {
  const label = p.repo ? '' : p.lab ? '  (lab — repo-less by design)' : '  (no local repo on this machine — notebook only)';
  const out = [`### ${name}${label}`];
  const sess = headFile(join(p.notebook, 'SESSION.md'), SESSION_PEEK);
  if (sess.trim()) out.push('', '-- SESSION (where we left off) --', sess);
  const sc = scan(p.notebook);
  if (sc.open.length) {
    out.push('', '-- open tickets --');
    for (const t of sc.open) out.push(`  [${t.status}] ${t.id} — ${t.title}`);
  }
  if (p.repo) {
    out.push('', formatWip('-- working tree --', p.repo, WIP_FILES, WIP_COMMITS));
    for (const rel of watchRepos(p.repo)) {
      const abs = resolve(p.repo, rel);
      if (existsSync(abs)) out.push(formatWip(`   watched: ${basename(abs)}`, abs, WIP_FILES, WIP_COMMITS));
    }
  }
  return out.join('\n');
}

// ---- CLI (guarded — no side effects on import) ----------------------------
function main() {
  // `--brief` is the terse glance behind /status & /standup: collapse the review backlog to a
  // count + a few ids, and DROP the active-project SESSION dump (the wall). A named project
  // still gets the full deep view — brevity is the default, depth is opt-in via naming.
  const rawArgs = process.argv.slice(2).filter(Boolean);
  const brief = rawArgs.includes('--brief');
  const arg = rawArgs.filter((a) => !a.startsWith('--'));

  // The active project: whatever repo this was invoked in (the strongest "what am I working
  // on" signal). Self-heal it into the registry so a first-ever run still persists it.
  const cwdRoot = gitRoot();
  const { projects, activeName } = discoverProjects(cwdRoot);
  if (activeName) recordProject(activeName, cwdRoot, null);

  const ordered = Object.keys(projects).sort((a, b) =>
    (a === activeName ? -1 : b === activeName ? 1 : a.localeCompare(b)));

  const lines = [];
  if (arg.length) {
    lines.push(`=== /prime — deep resume: ${arg.join(', ')} ===`);
    for (const name of arg) {
      lines.push('');
      if (projects[name]) lines.push(deepView(name, projects[name]));
      else lines.push(`### ${name}\n  (unknown project — not in the registry or central data on this machine)`);
    }
  } else {
    lines.push(brief
      ? '=== status — what needs you? ==='
      : '=== /prime — what needs you? (lazy cross-project briefing) ===');

    const waiting = [];
    for (const name of ordered) {
      const sc = scan(projects[name].notebook);
      if (brief && sc.review.length) {
        const ids = sc.review.slice(0, 4).map((t) => t.id).join(', ');
        const more = sc.review.length > 4 ? `, +${sc.review.length - 4} more` : '';
        waiting.push(`[${name}] ${sc.review.length} in review awaiting \`done\`: ${ids}${more}`);
      } else {
        for (const t of sc.review) waiting.push(`[${name}] ${t.id} in review — awaiting your \`done\`: ${t.title}`);
      }
      for (const q of sc.questions) waiting.push(`[${name}] open question: ${q}`);
      for (const n of sc.needs) waiting.push(`[${name}] ${n}`);
    }
    lines.push('', '## ⚠ WAITING ON YOU');
    if (waiting.length) for (const w of waiting) lines.push(`- ${w}`);
    else lines.push('- (nothing is blocked on you)');

    lines.push('', '## Open work by project');
    for (const name of ordered) {
      const p = projects[name];
      const c = scan(p.notebook).counts;
      const work = `${c.doing} doing, ${c.review} review, ${c.todo} todo`;
      const git = p.repo ? gitOneLine(p.repo) : p.lab ? 'lab — no repo' : 'no local repo here';
      lines.push(`${name === activeName ? '→' : ' '} ${name}: ${work}  |  git: ${git}`);
    }

    if (brief) {
      if (activeName) lines.push('', `→ active: ${activeName} — name it for the deep view (e.g. /status ${activeName})`);
    } else {
      lines.push('', '## Active project (deep view)');
      if (activeName && projects[activeName]) lines.push(deepView(activeName, projects[activeName]));
      else lines.push('  (not inside a tracked project — name one to drop into it: /prime <project>)');
    }
  }

  console.log(lines.join('\n'));
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
