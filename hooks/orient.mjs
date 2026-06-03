#!/usr/bin/env node
// SessionStart — inject the on-disk record into a fresh/compacted context so work
// never starts blind. No-ops unless the repo has adopted .ai/.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { git, gitRoot, adopted, projectName, formatWip, watchRepos, recordProject, WIP_FILES, WIP_COMMITS } from './lib.mjs';

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
