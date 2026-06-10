#!/usr/bin/env node
// PostToolUse (Write|Edit) — IMMEDIATE incremental ingest (KIT-T026/KIT-D024). When an edit
// lands a file under a managed repo's .ai store, sync THAT scope's cache right away, so a
// query in the same turn already sees the new/changed item (no waiting for the Stop hook's
// cross-scope refresh). The sync is incremental (manifest-diff), so this touches only the one
// file that changed — cheap enough to run per-write.
//
// FAIL-OPEN: a sync error (or no engine, or a non-store path) must NEVER wedge the tool call.
// Every path exits 0; the worst case is a slightly stale cache the Stop-hook refresh repairs.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { payload, storeRoot } from './lib.mjs';

try {
  const p = await payload();
  const file = (p.tool_input && p.tool_input.file_path) || '';
  if (!file) process.exit(0);

  const norm = resolve(file);
  const root = storeRoot(resolve(dirname(norm)));
  if (!root) process.exit(0); // not under any managed .ai store

  // Only ingest edits that actually live INSIDE that root's .ai store dir (a sibling source
  // file, e.g. README, is not a tracked item — skip it without a sync).
  const aiDir = join(root, '.ai');
  if (!(norm + sep).startsWith(resolve(aiDir) + sep)) process.exit(0);

  // Write-time advisories (fail-open, never block — this is PostToolUse). `t` mutations are fs
  // writes that bypass this hook, so these specifically nudge a HAND-EDIT that sidesteps the CLI:
  //   - STRUCTURE lint (KIT-T075): malformed frontmatter / leftover template placeholder.
  //   - EVIDENCE floor (KIT-T061): an active ticket flipped to its closing state with no test
  //     artifact cited — the commit-gate will hard-block it, so warn early at write time.
  try {
    const text = readFileSync(norm, 'utf8');
    const { lintStoreText, evidenceFloor, readConfig } = await import('../scripts/t.mjs');
    for (const w of lintStoreText(text, norm)) {
      process.stderr.write(`[ingest-data] structure lint: ${norm} — ${w}\n`);
    }
    if (/(^|[\\/])tickets[\\/]/.test(norm) && !/[\\/]archive[\\/]/.test(norm)) {
      const floor = evidenceFloor(text, readConfig(root).uatDefault);
      if (floor.needsEvidence) {
        process.stderr.write(`[ingest-data] evidence floor: ${norm} → ${floor.closing} cites no test artifact — add a test path / "npm test" / sha, or [no-test: reason] (the commit-gate will block otherwise; KIT-T061).\n`);
      }
    }
  } catch { /* advisories never wedge the ingest */ }

  const { hydrate, defaultDbPath } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ root, dbPath: defaultDbPath() });
  if (r && r.ok && (r.reparsed || r.deleted)) {
    process.stderr.write(`[ingest-data] synced ${root} (+${r.reparsed} ~${r.deleted})\n`);
  }
} catch {
  /* fail-open — the cache is never a hard dependency, and the Stop refresh repairs drift */
}
process.exit(0);
