#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — block a BRANCH FLIP of a shared working tree (KIT-T082).
// exit 2 = block, 0 = allow. No-ops on unadopted repos.
//
// WHY: multiple agents routinely share ONE checkout. A `git switch` / `git checkout -b` /
// `git checkout <branch>` flips that shared tree out from under every other agent and corrupts
// their in-flight work. The correct model for parallel work is an isolated git WORKTREE (cf.
// the Agent tool's `isolation: worktree`), NOT flipping the shared branch — so this gate refuses
// the flip and points at worktrees, with a deliberate, logged escape.
//
// BLOCKS:  git switch <x> | git switch -c <x> | git checkout -b|-B <x> | git checkout <branch>
// ALLOWS:  git checkout -- <file> | git checkout <ref> -- <file> | git checkout <path>
//          git worktree add … | git branch … (list/create-without-switch) | any non-git command
// ESCAPE:  an inline [allow-branch: <reason>] token, or env CLAUDE_KIT_ALLOW_BRANCH=1.
//
// FAIL-OPEN: any parse/git error exits 0 — a broken guard must never wedge a shell command
// (HOOK CONTRACT). The BLOCK is the only non-zero exit, and only on a positively-classified flip.

import { payload, git, gitRoot, adopted } from './lib.mjs';

try {
  const p = await payload();
  const command = (p.tool_input && p.tool_input.command) || '';

  // Fast out: only git switch/checkout commands can be a flip.
  if (!/\bgit\b/.test(command) || !/\b(?:switch|checkout)\b/.test(command)) process.exit(0);

  // Deliberate, logged escape — same shape as [no-log:] / [no-test:].
  if (/\[allow-branch\b/i.test(command) || /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_BRANCH || '')) process.exit(0);

  // Resolve the repo the command targets (a leading `cd <path>` or `git -C <path>`), so ref
  // resolution + the adopted check run against the right tree. Mirrors commit-gate.targetDir.
  const targetDir = (cmd) => {
    let m = cmd.match(/(?:^|&&|;)\s*cd\s+(\S[^&;|]*)/);
    let path = m ? m[1].trim() : '';
    if (!path) { m = cmd.match(/git\s+-C\s+("[^"]+"|'[^']+'|\S+)/); path = m ? m[1].trim() : ''; }
    if (!path) return process.cwd();
    return path.replace(/^["']|["']$/g, '').replace(/^\/([A-Za-z])\//, '$1:/');
  };
  const root = gitRoot(targetDir(command));
  if (!adopted(root)) process.exit(0); // workflow repos only — never interfere elsewhere

  const tokenize = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((t) => t[1] ?? t[2] ?? t[3]);
  // A name is a branch iff refs/heads/<name> resolves — so a FILENAME never reads as a branch
  // (the classic checkout ambiguity is sidestepped). git() fails open to '' on a non-branch.
  const isBranch = (name) => git(['-C', root, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`]).trim() !== '';

  // A shell line may chain several commands; classify each git segment independently.
  const segments = command.split(/&&|\|\||[;&|]/).map((s) => s.trim()).filter(Boolean);
  const GLOBAL_VALUE_OPTS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace']);

  for (const seg of segments) {
    const m = seg.match(/\bgit\b\s+(.+)/s);
    if (!m) continue;
    const toks = tokenize(m[1]);

    // Skip git's GLOBAL options to land on the subcommand (e.g. `git -C dir switch x`).
    let i = 0;
    while (i < toks.length) {
      const t = toks[i];
      if (GLOBAL_VALUE_OPTS.has(t)) { i += 2; continue; }
      if (t.startsWith('-')) { i++; continue; }
      break;
    }
    const sub = toks[i];
    const rest = toks.slice(i + 1);
    if (sub !== 'switch' && sub !== 'checkout') continue;

    let flip = '';
    if (sub === 'switch') {
      // `switch` is branch-only by design — any operand (a branch, or -c/-C to create) is a flip;
      // a bare `git switch` (error) or help-only invocation is not.
      if (rest.some((t) => !/^(-h|--help)$/.test(t))) flip = `git switch ${rest.join(' ')}`.trim();
    } else {
      // checkout: a `--` (or a recognized pathspec) means a FILE op, not a branch flip — allow.
      if (rest.includes('--')) continue;
      if (rest.includes('-b') || rest.includes('-B')) {
        flip = `git checkout ${rest.join(' ')}`.trim(); // create + switch
      } else {
        const operand = rest.find((t) => !t.startsWith('-'));
        if (operand && isBranch(operand)) flip = `git checkout ${operand}`; // switch to an existing branch
      }
    }

    if (flip) {
      process.stderr.write(
        [
          '',
          'BLOCKED: branch switch/create in a shared checkout (KIT-T082).',
          `  ${flip}`,
          '',
          'Multiple agents share THIS working tree — flipping its branch corrupts everyone',
          "else's in-flight work. For isolated parallel work, use a git WORKTREE (a separate",
          'checkout dir on its own branch), not a flip of the shared tree:',
          '  git worktree add ../<name> -b <new-branch>     # new branch in a new dir',
          '  git worktree add ../<name> <existing-branch>   # existing branch in a new dir',
          '',
          'If you really must switch THIS shared checkout, add a deliberate, logged escape:',
          '  • include [allow-branch: <reason>] in the command, or',
          '  • set CLAUDE_KIT_ALLOW_BRANCH=1.',
          '',
        ].join('\n'),
      );
      process.exit(2);
    }
  }
  process.exit(0);
} catch {
  process.exit(0); // fail-open per HOOK CONTRACT
}
