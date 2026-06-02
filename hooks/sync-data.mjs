#!/usr/bin/env node
// Stop — auto-commit + push the centralized workflow-data repo (claude-kit-data) when
// it has changes, so a turn's .ai/ edits persist without manual ceremony (D-008). The
// project repo's CODE commits still carry the ticket citation; the data repo syncs
// itself. No-ops unless the current repo's .ai resolves into a separate git repo.

import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, git } from './lib.mjs';

const proj = gitRoot();
if (!proj) process.exit(0);

// Resolve the data repo via the .ai junction/symlink target.
let dataRoot = '';
try {
  const ai = join(proj, '.ai');
  if (!existsSync(ai)) process.exit(0);
  const real = realpathSync(ai);
  const top = git(['-C', real, 'rev-parse', '--show-toplevel']).trim();
  // Only treat it as centralized if .ai lives in a DIFFERENT repo than the project.
  if (top && realpathSync(top) !== realpathSync(proj)) dataRoot = top;
} catch {
  process.exit(0);
}
if (!dataRoot) process.exit(0);

if (!git(['-C', dataRoot, 'status', '--porcelain']).trim()) process.exit(0);

git(['-C', dataRoot, 'add', '-A']);
git(['-C', dataRoot, 'commit', '-m', 'sync: workflow data']);
git(['-C', dataRoot, 'push']);
process.stderr.write('[sync-data] committed + pushed claude-kit-data\n');
