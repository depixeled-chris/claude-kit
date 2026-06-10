#!/usr/bin/env node
// Stop — auto-commit + push the centralized workflow-data repo (claude-kit-data) when
// it has changes, so a turn's .ai/ edits persist without manual ceremony (D-008). The
// project repo's CODE commits still carry the ticket citation; the data repo syncs
// itself. No-ops unless the current repo's .ai resolves into a separate git repo.

import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, git, gitTry } from './lib.mjs';

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

// Don't auto-commit a duplicate/mismatched id into the data repo. This is the
// guard for centralized projects (the path that let two HOD-T045 files persist):
// the dup lands here, not through commit-gate. checkIds scans this project's .ai
// (resolved through the junction). Block the stop so it's fixed now; fail open on
// a scan error so a parse glitch never wedges the session.
try {
  // dynamic so a broken scripts/ tree degrades to fail-open instead of an import-time crash (KIT-T055)
  const { checkIds } = await import('../scripts/id-utils.mjs');
  const { duplicates, mismatches } = checkIds(proj);
  if (duplicates.length || mismatches.length) {
    const lines = ['', '[sync-data] BLOCKED: .ai id integrity check failed — NOT committing.', ''];
    for (const d of duplicates) lines.push(`  DUPLICATE ${d.id}: ${d.files.join('  ·  ')}`);
    for (const m of mismatches) lines.push(`  MISMATCH ${m.file}: id '${m.fmId}' != filename '${m.fileId}'`);
    lines.push('', 'Re-key the offending file (scripts/next-id.mjs <store>) so every id is unique.', '');
    process.stderr.write(lines.join('\n'));
    process.exit(2);
  }
} catch {
  /* integrity scan is best-effort — never wedge a stop on a scan error */
}

// KIT-T053: every step is VERIFIED — a receipt is only emitted for what actually
// happened, and a failure surfaces the real git error instead of a false success.
git(['-C', dataRoot, 'add', '-A']);
const commit = gitTry(['-C', dataRoot, 'commit', '-m', 'sync: workflow data']);
if (!commit.ok) {
  process.stderr.write(`[sync-data] commit FAILED — data repo NOT synced:\n${commit.out.trim()}\n`);
  process.exit(0);
}

if (!git(['-C', dataRoot, 'remote']).trim()) {
  process.stderr.write('[sync-data] committed claude-kit-data (no remote configured — not pushed)\n');
  process.exit(0);
}

// Rejected push (the other machine moved first): fetch+rebase once, retry. A rebase
// that conflicts is aborted so the repo is never left mid-rebase; the local commit
// stays and the failure is reported for manual reconciliation.
let push = gitTry(['-C', dataRoot, 'push']);
if (!push.ok) {
  const rebase = gitTry(['-C', dataRoot, 'pull', '--rebase']);
  if (rebase.ok) {
    push = gitTry(['-C', dataRoot, 'push']);
  } else {
    gitTry(['-C', dataRoot, 'rebase', '--abort']);
    push = { ok: false, out: `${push.out.trim()}\nrebase also failed:\n${rebase.out.trim()}` };
  }
}
if (push.ok) {
  process.stderr.write('[sync-data] committed + pushed claude-kit-data\n');
} else {
  process.stderr.write(
    `[sync-data] committed locally but PUSH FAILED — claude-kit-data is NOT synced (other machines cannot see this turn). Reconcile manually:\n${push.out.trim()}\n`,
  );
}
