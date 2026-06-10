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

  // Write-time STRUCTURE lint (KIT-T075): a hand-edit that malforms the frontmatter (no closing
  // `---`, missing id, leftover template placeholder) is named on stderr — the suspenders to the
  // `t` CLI's belt. Strictly advisory: fail-open, never blocks the write (this is PostToolUse).
  try {
    const { lintStoreText } = await import('../scripts/t.mjs');
    for (const w of lintStoreText(readFileSync(norm, 'utf8'), norm)) {
      process.stderr.write(`[ingest-data] structure lint: ${norm} — ${w}\n`);
    }
  } catch { /* lint is advisory; never let it wedge the ingest */ }

  const { hydrate, defaultDbPath } = await import('../scripts/hydrate-db.mjs');
  const r = await hydrate({ root, dbPath: defaultDbPath() });
  if (r && r.ok && (r.reparsed || r.deleted)) {
    process.stderr.write(`[ingest-data] synced ${root} (+${r.reparsed} ~${r.deleted})\n`);
  }
} catch {
  /* fail-open — the cache is never a hard dependency, and the Stop refresh repairs drift */
}
process.exit(0);
