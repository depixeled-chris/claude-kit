#!/usr/bin/env node
// triage.mjs — programmatic cross-project triage (KIT-T027 Phase 1). The SCRIPT half of the
// gather→classify→apply loop; the LLM only classifies the irreducible-prose caps in between
// (see commands/triage.md for the lockstep). Two modes:
//
//   node scripts/triage.mjs --plan [--scope X] [--json]
//       GATHER. Read EVERY store='inbox' cap from the cache on ONE held-open handle (KIT-D025),
//       split DETERMINISTIC (explicit (type) → config route+priority, no LLM) from AMBIGUOUS
//       (untyped prose → needsClassification), attach dedup candidates, and emit the triage-plan
//       the LLM classifier consumes.
//
//   node scripts/triage.mjs --apply <decisions.json> [--json]
//       APPLY. Enact each decision (create/fold/supersede/skip) — ids via next-id on the held
//       handle (NEVER hand-picked), items written from each store's _TEMPLATE.md, every processed
//       cap moved to inbox/triaged/ (never deleted). Then re-sync the cache and print cross-project
//       receipts + a drain-ordered worklist per scope.
//
// The cache path honors $CLAUDE_PLUGIN_ROOT (defaultDbPath), so a test points it at a throwaway
// install and never touches the real cache/stores.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDbPath } from './hydrate-db.mjs';
import { plan } from './triage/plan.mjs';
import { apply } from './triage/apply.mjs';

export { plan, apply };

async function main() {
  const argv = process.argv.slice(2);
  const json = argv.includes('--json');
  const dbPath = defaultDbPath();

  if (argv.includes('--plan')) {
    const si = argv.indexOf('--scope');
    const scopeFilter = si >= 0 ? argv[si + 1] : undefined;
    await plan({ scopeFilter, json, dbPath });
    return;
  }

  const ai = argv.indexOf('--apply');
  if (ai >= 0) {
    const decisionsPath = argv[ai + 1];
    if (!decisionsPath) { process.stderr.write('usage: triage.mjs --apply <decisions.json>\n'); process.exit(2); }
    await apply({ decisionsPath, json, dbPath });
    return;
  }

  process.stderr.write('usage: triage.mjs --plan [--scope X] [--json] | --apply <decisions.json> [--json]\n');
  process.exit(2);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    process.stderr.write(`triage: ${e && e.message ? e.message : e}\n`);
    process.exit(1);
  });
}
