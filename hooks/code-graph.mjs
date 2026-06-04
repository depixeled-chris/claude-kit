#!/usr/bin/env node
// Stop — keep the code graph fresh (KIT-T012). Once per turn, rebuild the repo's graph
// IF stale (a source file is newer than the cached graph). Opt-in-aware (no-ops unless
// the repo has .ai/), and fail-open: any error just skips — a code-graph refresh must
// never wedge a session.
//
// The cache is MACHINE-LOCAL (~/.claude/cache/code-graph/<key>.json), never in the repo,
// so no project needs to gitignore it (mirrors KIT-T004's "derived, outside the repo").

import { existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { gitRoot, adopted } from './lib.mjs';
import { buildGraph, listSourceFiles } from '../scripts/code-graph.mjs';

try {
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  // CLAUDE_CODE_GRAPH_CACHE overrides the cache dir so the test harness can isolate from
  // the real ~/.claude (same pattern as CLAUDE_KIT_REGISTRY).
  const cacheDir = process.env.CLAUDE_CODE_GRAPH_CACHE || join(homedir(), '.claude', 'cache', 'code-graph');
  const key = root.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const cacheFile = join(cacheDir, key + '.json');

  const cacheMtime = existsSync(cacheFile) ? statSync(cacheFile).mtimeMs : 0;
  if (cacheMtime) {
    // Cheap staleness: stat (not read) the sources; rebuild only if one is newer.
    let newest = 0;
    for (const f of listSourceFiles(root)) {
      try {
        const m = statSync(f).mtimeMs;
        if (m > newest) newest = m;
      } catch {
        /* file vanished mid-walk — ignore */
      }
    }
    if (newest <= cacheMtime) process.exit(0); // fresh
  }

  mkdirSync(cacheDir, { recursive: true });
  const graph = await buildGraph(root);
  writeFileSync(cacheFile, JSON.stringify(graph));
  process.stderr.write(`[code-graph] refreshed ${graph.files.length} files -> ${cacheFile}\n`);
} catch {
  process.exit(0); // fail-open — never block a stop on a graph refresh
}
