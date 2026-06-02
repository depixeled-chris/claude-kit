#!/usr/bin/env node
// PreCompact — remind to flush durable state before context (and detail) is lost.
// The post-compaction SessionStart re-surfaces the record. No-ops on unadopted repos.

import { join } from 'node:path';
import { gitRoot, adopted, git } from './lib.mjs';

const root = gitRoot();
if (!adopted(root)) process.exit(0);

const head = git(['-C', root, 'rev-parse', '--short', 'HEAD']).trim() || 'none';
const branch = git(['-C', root, 'rev-parse', '--abbrev-ref', 'HEAD']).trim() || 'none';

console.log(`=== COMPACTION IMMINENT — flush before detail is lost ===
The on-disk record survives this, not the conversation. Before continuing:
- Decisions/directives from this session -> ${join(root, '.ai', 'DECISIONS.md')}
- Working state + next steps (verbatim commands/paths) -> ${join(root, '.ai', 'SESSION.md')}
- Work in flight -> the plan-of-record / its ticket
After compaction, trust .ai/ + git (${branch}@${head}) over the summary.
=========================================================`);
process.exit(0);
