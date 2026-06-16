#!/usr/bin/env node
// PostToolUse(Bash|PowerShell) — hydrate the SQLite cache when Claude runs a git
// pull/merge/checkout/switch/rebase command, so out-of-band item changes land in the
// cache immediately rather than waiting for the next Stop (KIT-T097).
//
// Fail-open: any error (no engine, unadopted repo, bad payload) exits 0 silently.
// No-op on: non-git commands, git commit/push/status, unadopted repos.

import { payload, gitRoot, adopted } from './lib.mjs';

// Match git ops that bring in remote or branch changes; NOT commit/push/status/log/fetch alone.
const GIT_PULL_RE = /\bgit\s+(?:.*\s)?(pull|merge|checkout|switch|rebase)\b/;

try {
  const p = await payload();
  const cmd = (p && p.tool_input && p.tool_input.command) || '';
  if (!GIT_PULL_RE.test(cmd)) process.exit(0);

  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const { hydrate } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ ifStale: true });
  if (r && r.ok && !r.skipped) {
    process.stderr.write(`[git-pull-hydrate] refreshed ${r.items} items across ${r.scopes} scope(s)\n`);
  }
} catch {
  /* fail-open — a hydrate error must never block the tool call */
}

process.exit(0);
