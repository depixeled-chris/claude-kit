#!/usr/bin/env node
// PreCompact — remind to flush durable state before context (and detail) is lost.
// The post-compaction SessionStart re-surfaces the record. No-ops on unadopted repos.
// Also surfaces un-triaged inbox items so captured-but-unrouted requests don't die at
// the context boundary (the exact failure the capture ratchet exists to prevent).

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, adopted, git } from './lib.mjs';

const root = gitRoot();
if (!adopted(root)) process.exit(0);

const head = git(['-C', root, 'rev-parse', '--short', 'HEAD']).trim() || 'none';
const branch = git(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'none';

let inboxNote = '';
try {
  const pending = readdirSync(join(root, '.ai', 'inbox')).filter((n) => n.endsWith('.md') && !/^README/i.test(n));
  if (pending.length) {
    inboxNote = `\n- ${pending.length} UN-TRIAGED inbox item(s) — drain (triage) or they vanish at the boundary:\n` +
      pending.slice(0, 10).map((n) => `    .ai/inbox/${n}`).join('\n');
  }
} catch {
  /* no inbox dir — fine */
}

console.log(`=== COMPACTION IMMINENT — flush before detail is lost ===
The on-disk record survives this, not the conversation. Before continuing:
- Decisions/directives from this session -> ${join(root, '.ai', 'decisions')}/ (one file per decision)
- Working state + next steps (verbatim commands/paths) -> ${join(root, '.ai', 'SESSION.md')}
- Work in flight -> the plan-of-record / its ticket${inboxNote}
After compaction, trust .ai/ + git (${branch}@${head}) over the summary.
=========================================================`);
process.exit(0);
