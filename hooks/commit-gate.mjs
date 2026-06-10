#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — block a `git commit` of code that isn't tied to the
// plan-of-record / a ticket. exit 2 = block, 0 = allow. No-ops on unadopted repos.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { payload, git, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';

const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);

const p = await payload();
const command = (p.tool_input && p.tool_input.command) || '';
if (!/\bgit\s+(?:-C\s+\S+\s+|--?\S+\s+)*commit\b/.test(command)) process.exit(0);

// The commit runs in the repo the command targets, not the session cwd: resolve a
// leading `cd <path>` or `git -C <path>`. Translate an MSYS path (/d/dev/x) to a
// Windows path (d:/dev/x) so `git -C` accepts it. Falls back to cwd.
function targetDir(cmd) {
  let m = cmd.match(/(?:^|&&|;)\s*cd\s+(\S[^&;|]*)/);
  let path = m ? m[1].trim() : '';
  if (!path) {
    m = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/);
    path = m ? m[1].trim() : '';
  }
  if (!path) return process.cwd();
  path = path.replace(/^["']|["']$/g, '');
  return path.replace(/^\/([A-Za-z])\//, '$1:/');
}

const root = gitRoot(targetDir(command));
if (!adopted(root)) process.exit(0);
// Centralized data (D-008): the plan-of-record lives in claude-kit-data, not this repo,
// so it can't be touched in this commit — the gate is cite-only here.
const centralized = existsSync(join(root, '.claude-project'));

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const uniq = (a) => [...new Set(a)];

// KIT-T052: judge the COMMIT'S file set, not the whole dirty tree.
//   explicit pathspec -> git's own matching (`status --porcelain -- <paths>`)
//   -a/--all          -> tracked modified + staged
//   bare commit       -> staged set only
// Shell parsing is heuristic: anything unrecognized falls back to the whole
// dirty tree — the strict direction, so the gate may narrow but never leak.
function commitSpec(cmd) {
  const m = cmd.match(/\bgit\s+(?:-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+|--?\S+\s+)*commit\b/);
  if (!m) return { mode: 'tree' };
  let seg = '';
  let q = '';
  for (const ch of cmd.slice(m.index + m[0].length)) {
    if (q) { seg += ch; if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'") { q = ch; seg += ch; continue; }
    if (ch === ';' || ch === '|' || ch === '&') break;
    seg += ch;
  }
  // options whose value arrives as the NEXT token (long form without '=')
  const VALUE_OPTS = new Set(['-m', '-F', '-t', '-c', '-C', '--message', '--file', '--template', '--author', '--date', '--cleanup', '--fixup', '--squash', '--reuse-message', '--reedit-message', '--trailer', '--pathspec-from-file']);
  const toks = [...seg.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
  const paths = [];
  let all = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === '--') { paths.push(...toks.slice(i + 1)); break; }
    if (t === '-a' || t === '--all') { all = true; continue; }
    if (t.startsWith('--')) { if (VALUE_OPTS.has(t)) i++; continue; }
    if (t.startsWith('-')) {
      // short cluster (-am): 'a' flags all; a trailing value-taking letter consumes the next token
      if (t.includes('a')) all = true;
      if (/[mFtcC]$/.test(t)) i++;
      continue;
    }
    paths.push(t);
  }
  if (paths.length) return { mode: 'paths', paths };
  return { mode: all ? 'all' : 'staged' };
}

// porcelain v1: two status columns + space, renames as `R  old -> new`
const porcelainFiles = (raw) =>
  raw.split('\n').filter(Boolean).map((l) => {
    let p = l.slice('XY '.length);
    if (p.includes(' -> ')) p = p.split(' -> ').pop();
    return p.replace(/^"|"$/g, '');
  });

const spec = commitSpec(command);
let changed;
if (spec.mode === 'paths') {
  changed = uniq(porcelainFiles(git(['-C', root, 'status', '--porcelain', '--', ...spec.paths])));
} else if (spec.mode === 'staged') {
  changed = uniq(lines(git(['-C', root, 'diff', '--cached', '--name-only'])));
} else if (spec.mode === 'all') {
  changed = uniq([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
  ]);
} else {
  changed = uniq([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
    ...lines(git(['-C', root, 'ls-files', '--others', '--exclude-standard'])),
  ]);
}
if (!changed.length) process.exit(0);

// ID integrity: if this commit touches the markdown stores, refuse it when the
// stores hold a duplicate id or a frontmatter/filename mismatch. This runs BEFORE
// the plan-of-record early-allow below so touching a ticket can't bypass it. The
// centralized layout (.ai is a junction into the data repo) is guarded separately
// by sync-data; here `root`'s own .ai is scanned. Fail open on any scan error.
if (changed.some((f) => /(^|\/)(?:\.ai\/)?(?:tickets|decisions|notes|questions)\/[^/]+\.md$/.test(f))) {
  try {
    // dynamic so a broken scripts/ tree degrades to fail-open instead of an import-time crash (KIT-T055)
    const { checkIds } = await import('../scripts/id-utils.mjs');
    const { duplicates, mismatches } = checkIds(root);
    if (duplicates.length || mismatches.length) {
      const lines = ['', 'BLOCKED: .ai id integrity check failed.', ''];
      for (const d of duplicates) lines.push(`  DUPLICATE ${d.id}: ${d.files.join('  ·  ')}`);
      for (const m of mismatches) lines.push(`  MISMATCH ${m.file}: id '${m.fmId}' != filename '${m.fileId}'`);
      lines.push('', 'Re-key the offending file (scripts/next-id.mjs <store>) so every id is unique, then commit.', '');
      process.stderr.write(lines.join('\n'));
      process.exit(2);
    }
  } catch {
    /* integrity scan is best-effort — never wedge a commit on a scan error */
  }
}

// Plan-of-record part of the change? A root/legacy ROADMAP|DECISIONS.md, or any of the
// atomic .ai/ stores (tickets/decisions/questions/notes/inbox — D-009).
if (changed.some((f) => /(^|\/)(ROADMAP|DECISIONS)\.md$/i.test(f) || /\.ai\/(tickets|decisions|questions|notes|inbox)\//.test(f))) {
  process.exit(0);
}
// Commit cites a logged item, or explicitly overrides? Scheme <KEY>-<TYPE><NUM> (HOD-T045,
// KIT-D010), type letter one of T/D/N/Q · or [no-log:].
if (/\b[A-Z]{2,}-[TDNQ]\d+\b|\[no-log/.test(command)) process.exit(0);

// Does the change actually touch code? (docs/config-only commits are fine)
// KIT-T051: a code file path excluded from `commit-log` doesn't count toward the
// citation requirement — so a generated/vendored tree can be committed uncited.
const touchesCode = changed.some(
  (f) => CODE.has((f.split('.').pop() || '').toLowerCase()) && !pathExcluded(root, 'commit-log', f),
);
if (!touchesCode) process.exit(0);

const blockedLine = centralized
  ? 'BLOCKED: code commit with no ticket citation (workflow data is centralized — KIT-D008).'
  : 'BLOCKED: this commit changes code but does not touch the plan-of-record.';
const options = centralized
  ? [
      "  - cite the ticket in the message (e.g. 'implements HOD-T045' / 'KIT-T007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ]
  : [
      '  - update the plan-of-record (ROADMAP / a .ai/ticket) in this commit, or',
      '  - record a decision in DECISIONS, or',
      "  - cite the item in the message (e.g. 'implements HOD-T041' / 'KIT-T007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ];
process.stderr.write(
  ['', blockedLine, '', 'Before committing, do ONE of:', ...options, '', 'Unlogged work is lost across sessions. This gate is the enforcement, not memory.', ''].join('\n') +
    excludeFooter('commit-log'),
);
process.exit(2);
