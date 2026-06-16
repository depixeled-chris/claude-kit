#!/usr/bin/env node
// install-git-hooks.mjs — set core.hooksPath on a target repo to point at this
// plugin's .githooks/ dir so post-merge/checkout/rewrite fire hydrate-db.mjs (KIT-T097).
//
//   node scripts/install-git-hooks.mjs [repoPath]
//
// Defaults to the cwd's git root when repoPath is omitted.
// GUARDS (never clobber existing hooks):
//   - target already has core.hooksPath pointing ELSEWHERE → WARN + SKIP
//   - target already has non-.sample files in .git/hooks/ → WARN + SKIP
// Idempotent: if core.hooksPath already equals ours → print "already installed" + exit 0.

import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// The plugin root is two levels up from this file (scripts/ → plugin root).
const PLUGIN_ROOT = resolve(join(fileURLToPath(import.meta.url), '..', '..'));
const GITHOOKS = join(PLUGIN_ROOT, '.githooks');

function gitCmd(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    return (e && e.stderr && e.stderr.toString().trim()) || '';
  }
}

function gitRoot(cwd) {
  const r = gitCmd(['-C', cwd, 'rev-parse', '--show-toplevel'], cwd);
  return r && !r.startsWith('fatal') ? r : null;
}

export async function installGitHooks(repoPath) {
  // Resolve the repo root.
  const cwd = repoPath ? resolve(repoPath) : process.cwd();
  const root = gitRoot(cwd);
  if (!root) {
    process.stderr.write(`install-git-hooks: not a git repo: ${cwd}\n`);
    return false;
  }

  // Confirm our .githooks dir exists (sanity-check against a bad plugin install).
  if (!existsSync(GITHOOKS)) {
    process.stderr.write(`install-git-hooks: plugin .githooks not found at ${GITHOOKS}\n`);
    return false;
  }

  // Check existing core.hooksPath.
  const existing = gitCmd(['-C', root, 'config', '--local', 'core.hooksPath'], root);
  const ours = resolve(GITHOOKS);

  if (existing && !existing.startsWith('fatal') && existing !== '') {
    if (resolve(existing) === ours) {
      console.log(`install-git-hooks: already installed on ${root}`);
      return true;
    }
    process.stderr.write(
      `install-git-hooks: WARN — ${root} already has core.hooksPath=${existing}` +
      ` (differs from ours: ${ours}). Skipping to avoid clobbering.\n`,
    );
    return false;
  }

  // Guard: non-.sample files in .git/hooks/ (e.g. husky installs real hooks there).
  const gitHooksDir = join(root, '.git', 'hooks');
  let hasRealHooks = false;
  try {
    const entries = readdirSync(gitHooksDir);
    hasRealHooks = entries.some((f) => !f.endsWith('.sample') && f !== 'README.md');
  } catch {
    /* .git/hooks doesn't exist yet — clean to install */
  }
  if (hasRealHooks) {
    process.stderr.write(
      `install-git-hooks: WARN — ${root}/.git/hooks contains non-sample files` +
      ` (possible husky/lefthook install). Skipping to avoid clobbering.\n`,
    );
    return false;
  }

  // Set core.hooksPath.
  gitCmd(['-C', root, 'config', 'core.hooksPath', ours], root);

  // Verify it took.
  const got = gitCmd(['-C', root, 'config', '--local', 'core.hooksPath'], root);
  if (resolve(got) !== ours) {
    process.stderr.write(`install-git-hooks: ERROR — failed to set core.hooksPath on ${root}\n`);
    return false;
  }

  console.log(`install-git-hooks: installed on ${root} -> core.hooksPath=${ours}`);
  return true;
}

// CLI entry point.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repoArg = process.argv[2];
  const ok = await installGitHooks(repoArg);
  process.exit(ok ? 0 : 1);
}
