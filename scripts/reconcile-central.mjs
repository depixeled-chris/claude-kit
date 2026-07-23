#!/usr/bin/env node
// reconcile-central.mjs — back-fill the central store (claude-kit-data) with projects whose
// .ai still lives in-repo, so a machine already using the central store stops leaking new
// adoptions invisibly cross-machine (KIT-T134). DRY-RUN by default; --execute performs the
// migration. Every guard is HARD: a case that trips one is REPORTED and left untouched — a
// refusal is a report line, never a whole-run error exit, and never worked around.
//
//   node scripts/reconcile-central.mjs                 # dry-run, all registry projects
//   node scripts/reconcile-central.mjs --execute a b   # migrate ONLY projects a and b
//
// Migration (per clean case, --execute): copy <repo>/.ai -> <dataRoot>/projects/<name>,
// commit it in claude-kit-data (git-recoverable BEFORE the repo copy is removed), replace
// <repo>/.ai with a junction into it, gitignore .ai, write the .claude-project pointer, and
// commit the .ai removal in the project repo. Both commits cite KIT-T134. When BOTH an
// in-repo and a central copy exist it is a SPLIT BRAIN only the human can reconcile — REFUSE
// with a divergence summary (ticket counts + newest mtimes), never merge or clobber.

import { existsSync, readFileSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, gitTry, readRegistry, centralDataRoot } from '../hooks/lib.mjs';
import { copyDir, linkAiJunction, writeProjectPointer, updateGitignore, CENTRAL_GITIGNORE } from './centralize.mjs';

const KIT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CITE = 'KIT-T134';
const NAME_COL = 22; // report column width for the project name
const TAG_COL = 9; // report column width for the action tag (widest tag "MIGRATED" + a space)
const ISO_DATE_LEN = 10; // "YYYY-MM-DD" prefix of an ISO timestamp

const KEY_RE = /^[ \t]*key:[ \t]*["']?([A-Za-z0-9]+)["']?[ \t]*$/m;
const PLACEHOLDER_KEY = 'KEY';

// The ids.key from a notebook's config.yml ('' when missing/unreadable).
function configKey(aiDir) {
  try {
    const m = readFileSync(join(aiDir, 'config.yml'), 'utf8').match(KEY_RE);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

// Ticket-file count under a notebook (INDEX.md excluded) — a divergence signal for split brains.
function ticketCount(aiDir) {
  try {
    return readdirSync(join(aiDir, 'tickets')).filter((f) => f.endsWith('.md') && f !== 'INDEX.md').length;
  } catch {
    return 0;
  }
}

// Newest file mtime (ms) anywhere under a dir, 0 when empty/unreadable — the other divergence signal.
function newestMtime(dir) {
  let newest = 0;
  const walk = (d) => {
    let entries;
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else { try { const m = statSync(p).mtimeMs; if (m > newest) newest = m; } catch { /* skip */ } }
    }
  };
  walk(dir);
  return newest;
}

const isoDay = (ms) => (ms ? new Date(ms).toISOString().slice(0, ISO_DATE_LEN) : '—');

// How many .ai files the project repo tracks — informational, and the basis for the
// "git-recoverable" note (the migration also commits the copy centrally regardless).
function trackedCount(repo) {
  const out = git(['-C', repo, 'ls-files', '.ai']);
  return out ? out.split('\n').filter(Boolean).length : 0;
}

// Classify ONE registry project into { action: 'migrate'|'refuse'|'skip', name, detail, ... }.
// SKIP = nothing to do (not present, kit-self, already centralized, unadopted). REFUSE = an
// anomaly or a split brain — the human decides. MIGRATE = a clean in-repo notebook to back-fill.
export function classify(name, repo, dataRoot) {
  const centralDir = join(dataRoot, 'projects', name);
  const aiDir = join(repo, '.ai');
  if (!repo || !existsSync(repo)) return { action: 'skip', name, detail: 'repo not present on this machine' };
  if (resolve(repo) === KIT_ROOT) return { action: 'skip', name, detail: 'kit self — stays in-repo' };
  if (centralDataRoot(repo)) return { action: 'skip', name, detail: 'already centralized (junction)' };
  if (!existsSync(aiDir)) return { action: 'skip', name, detail: 'no in-repo .ai — not adopted' };
  if (!existsSync(join(aiDir, 'config.yml'))) return { action: 'refuse', name, detail: 'ANOMALY: .ai has no config.yml' };
  const key = configKey(aiDir);
  if (!key || key === PLACEHOLDER_KEY) {
    return { action: 'refuse', name, detail: `ANOMALY: config key ${key ? `'${key}' is the placeholder` : 'is missing'} — fix the key, do not migrate garbage` };
  }
  if (existsSync(centralDir)) {
    const cN = ticketCount(centralDir);
    const rN = ticketCount(aiDir);
    const detail = `SPLIT-BRAIN: central ${cN} tickets (newest ${isoDay(newestMtime(centralDir))}) vs in-repo ${rN} tickets (newest ${isoDay(newestMtime(aiDir))}) — never clobber; reconcile by hand`;
    return { action: 'refuse', name, detail };
  }
  return { action: 'migrate', name, repo, aiDir, centralDir, key, tracked: trackedCount(repo) };
}

// Perform a classified migration. Order is chosen for git-recoverability: the central copy is
// committed BEFORE the in-repo copy is removed, so a failure never loses the notebook. Returns
// { ok, name, detail, dataSha?, repoSha? }; any failure is a REFUSE line, not a throw.
function migrate(c, dataRoot) {
  if (existsSync(c.centralDir)) return { ok: false, name: c.name, detail: 'REFUSE: central dir appeared since scan (split-brain) — skipped' };
  try {
    copyDir(c.aiDir, c.centralDir); // working-tree content, so uncommitted edits travel too
  } catch (e) {
    return { ok: false, name: c.name, detail: `REFUSE: copy to central failed (${e.message}) — nothing changed` };
  }
  git(['-C', dataRoot, 'add', '--', `projects/${c.name}`]); // pathspec-only: never sweeps a sibling's dirty file
  const dc = gitTry(['-C', dataRoot, 'commit', '-m', `${CITE}: back-fill ${c.name} into central store`]);
  const dataSha = dc.ok ? git(['-C', dataRoot, 'rev-parse', '--short', 'HEAD']).trim() : '(no-commit)';
  try {
    rmSync(c.aiDir, { recursive: true, force: true });
    linkAiJunction(c.repo, c.centralDir);
  } catch (e) {
    try { copyDir(c.centralDir, c.aiDir); } catch { /* best-effort un-break */ }
    return { ok: false, name: c.name, detail: `REFUSE: junction step failed (${e.message}) — restored in-repo copy; central commit ${dataSha} left in place, investigate` };
  }
  updateGitignore(c.repo, CENTRAL_GITIGNORE);
  writeProjectPointer(c.repo, c.name);
  // -f: force the INDEX removal past git's local-modification safety check. --cached never
  // touches the working tree (now a junction), so -f only affects staging — safe, and needed
  // when the notebook had uncommitted edits at migration time (e.g. groovegrid).
  git(['-C', c.repo, 'rm', '-r', '--cached', '--quiet', '-f', '--ignore-unmatch', '.ai']);
  git(['-C', c.repo, 'add', '--', '.gitignore', '.claude-project']);
  const rc = gitTry(['-C', c.repo, 'commit', '-m', `${CITE}: centralize .ai into claude-kit-data (notebook now junctioned)`]);
  const repoSha = rc.ok ? git(['-C', c.repo, 'rev-parse', '--short', 'HEAD']).trim() : '(no-commit)';
  return { ok: true, name: c.name, dataSha, repoSha, detail: `data ${dataSha}, repo ${repoSha}` };
}

const tag = (t) => t.padEnd(TAG_COL);
const nm = (n) => String(n).padEnd(NAME_COL);

function main() {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--execute');
  const only = argv.filter((a) => !a.startsWith('--'));

  const reg = readRegistry();
  const dataRoot = reg.dataRoot;
  if (!dataRoot) {
    console.log('reconcile-central: no dataRoot registered — central store not in use; nothing to reconcile.');
    return;
  }
  if (!existsSync(dataRoot)) {
    console.log(`reconcile-central: dataRoot ${dataRoot} does not exist on this machine — cannot reconcile.`);
    return;
  }

  let names = Object.keys(reg.projects || {});
  if (only.length) names = names.filter((n) => only.includes(n));
  names.sort();
  const decisions = names.map((n) => classify(n, reg.projects[n], dataRoot));

  console.log(`reconcile-central (${execute ? 'EXECUTE' : 'DRY-RUN — no changes; pass --execute to act'})`);
  console.log(`dataRoot: ${dataRoot}`);
  console.log('');

  const migrations = decisions.filter((d) => d.action === 'migrate');
  const refusals = decisions.filter((d) => d.action === 'refuse');
  const skips = decisions.filter((d) => d.action === 'skip');
  let done = 0;
  let failed = 0;

  for (const d of migrations) {
    if (!execute) {
      console.log(`${tag('MIGRATE')}${nm(d.name)}${d.key} · ${d.tracked} .ai files tracked → projects/${d.name} (copy, junction, gitignore, commit ×2)`);
    } else {
      const r = migrate(d, dataRoot);
      if (r.ok) { done++; console.log(`${tag('MIGRATED')}${nm(d.name)}${r.detail}`); }
      else { failed++; console.log(`${tag('REFUSE')}${nm(d.name)}${r.detail}`); }
    }
  }
  for (const d of refusals) console.log(`${tag('REFUSE')}${nm(d.name)}${d.detail}`);
  for (const d of skips) console.log(`${tag('SKIP')}${nm(d.name)}${d.detail}`);

  console.log('');
  const migLabel = execute ? `${done} migrated` : `${migrations.length} to migrate`;
  console.log(`Summary: ${migLabel}, ${refusals.length + failed} refused, ${skips.length} skipped`);
}

main();
