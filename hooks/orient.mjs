#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { git, gitRoot, adopted } from './lib.mjs';

const COMMITS = 12;
const SESSION_LINES = 40;
const ROADMAP_LINES = 50;
const DECISIONS_LINES = 25;
const WIP_FILES = 12;
const WIP_COMMITS = 10;

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
function wipStatus(repoRoot, label) {
  const dirty = git(['-C', repoRoot, 'status', '--porcelain']).trim();
  const unpushed = git(['-C', repoRoot, 'log', '--branches', '--not', '--remotes', '--oneline']).trim();
  if (!dirty && !unpushed) return `${label}: clean + pushed`;
  const lines = [`${label}:`];
  if (dirty) {
    const d = dirty.split('\n');
    lines.push(`  ${d.length} uncommitted —`);
    d.slice(0, WIP_FILES).forEach((l) => lines.push(`    ${l}`));
    if (d.length > WIP_FILES) lines.push(`    …+${d.length - WIP_FILES} more`);
  }
  if (unpushed) {
    const u = unpushed.split('\n');
    lines.push(`  ${u.length} unpushed (local-only) commit(s) —`);
    u.slice(0, WIP_COMMITS).forEach((l) => lines.push(`    ${l}`));
  }
  return lines.join('\n');
}
function watchRepos() {
  try {
    const m = readFileSync(join(root, '.ai', 'config.yml'), 'utf8').match(/watch_repos:[ \t]*\[([^\]]*)\]/);
    if (m) return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  } catch {
    /* no config / no key */
  }
  return [];
}
const repos = [[root, `project (${basename(root)})`]];
try {
  const ai = join(root, '.ai');
  if (existsSync(ai)) {
    const dataRoot = gitRoot(realpathSync(ai));
    if (dataRoot && realpathSync(dataRoot) !== realpathSync(root)) repos.push([dataRoot, 'data repo (.ai)']);
  }
} catch {
  /* no .ai junction */
}
for (const rel of watchRepos()) {
  const abs = resolve(root, rel);
  if (existsSync(abs)) repos.push([abs, `watched: ${basename(abs)}`]);
}
out.push('');
out.push('--- Working tree (uncommitted + unpushed — reconcile vs the plan; the record may lag reality) ---');
for (const [r, label] of repos) out.push(wipStatus(r, label));

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
if (decisions) {
  out.push('');
  out.push('--- DECISIONS (recent) ---');
  out.push(tail(decisions, DECISIONS_LINES));
}
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
