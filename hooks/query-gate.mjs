#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — the RETRIEVAL gate. The failure it fixes (lived,
// 2026-06-06): an agent hand-greps the .ai/ work store for decisions/tickets/history,
// or greps the source tree to DISCOVER code — instead of querying the layers built
// for exactly that. `q` (the KIT-T004 cache) and `code-graph` (KIT-T012) are faster
// and see the links/graph a raw grep is blind to. Instructions are advisory and a
// blank context blows past them; this closes the shell path so the wrong action is
// impossible, not merely discouraged ("enforcement is hooks, not judgment").
//
//   - a text tool searching/reading the .ai store      -> BLOCK, hand back the `q` query
//   - a recursive / tree-wide source search (discovery) -> BLOCK, hand back code-graph
//
// ALLOWED (the maintainer's rule — grep is fine when you know exactly where + what):
//   - a targeted grep of a SPECIFIC named file
//   - piped filtering of a command's OUTPUT (`q sql ... | grep x`, `git log | grep y`)
//
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fail-open on any error.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';

const KIT = dirname(dirname(fileURLToPath(import.meta.url)));
const Q = join(KIT, 'scripts', 'q.mjs');
const GRAPH = join(KIT, 'scripts', 'code-graph.mjs');

// Text tools that READ/SEARCH file CONTENT (the wrong path for store + discovery).
const SEARCH = /^(?:grep|egrep|fgrep|rg|ag|ack|sed|awk|findstr|select-string|sls)$/;
const READ = /^(?:cat|head|tail|type|get-content|gc)$/;
// Anything in the .ai work store — the data `q` owns. Tickets/decisions/etc. may also
// be referenced bare (a `cd` already inside .ai), so match the store dirs too.
const STORE = /\.ai[\\/]|(?:^|[\\/\s"'])(?:tickets|decisions|inbox|questions|notes)[\\/]|\b(?:ROADMAP|DECISIONS)\.md\b/i;
// A recursive/tree-wide grep is DISCOVERY ("find me where X is"), the code-graph's job.
const RECURSIVE_FLAG = /(?:^|\s)(?:-[A-Za-z]*[rR][A-Za-z]*|--recursive|--include\b|--include-dir\b)/;
const FILEISH = /\.[A-Za-z0-9]{1,6}$/; // a concrete file arg (has an extension)

main().catch(() => process.exit(0)); // fail-open — never wedge a tool call on a parse slip

async function main() {
  const p = await payload();
  const cmd = ((p.tool_input && p.tool_input.command) || '').trim();
  if (!cmd) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0); // opt-in: only KIT-adopted repos

  // The leader (everything before the first pipe) is what READS files; segments after
  // a pipe only filter the leader's OUTPUT, so a `... | grep x` is never a file search.
  // The leader may itself chain commands (cd x && grep ...), so judge each one.
  const leader = cmd.split('|')[0];
  for (const raw of leader.split(/&&|;/)) {
    const c = raw.trim();
    if (!c) continue;
    const verdict = judge(c);
    if (verdict) {
      // KIT-T051 exclusion: a path glob under the verdict's check-id in
      // .claude-kit-ignore.yaml lets a command through (e.g. allow grepping a generated
      // tree). Match any path-ish token in the command against that id. Fail-open.
      if (excludedByConfig(root, verdict.id, c)) continue;
      process.stderr.write(verdict.msg + excludeFooter(verdict.id));
      process.exit(2);
    }
  }
  process.exit(0);
}

// True iff any path-ish argument in the command is excluded from `id` by a config glob.
function excludedByConfig(root, id, c) {
  try {
    const toks = c.split(/\s+/).filter((t) => t && !t.startsWith('-') && /[\\/.]/.test(t));
    return toks.some((t) => pathExcluded(root, id, t.replace(/^["']|["']$/g, '')));
  } catch {
    return false;
  }
}

// Return a block message, or null to allow. One simple command (no pipe/chain).
function judge(c) {
  const tok = c.split(/\s+/).filter(Boolean);
  if (!tok.length) return null;
  const tool = tok[0].replace(/.*[\\/]/, '').toLowerCase(); // basename, lower
  const gitGrep = tool === 'git' && (tok[1] || '').toLowerCase() === 'grep';
  const isSearch = SEARCH.test(tool) || gitGrep;
  const isRead = READ.test(tool);
  const isFind = tool === 'find' || tool === 'get-childitem' || tool === 'gci';

  // RULE 1 — never grep/read the work store; query it.
  if ((isSearch || isRead || isFind) && STORE.test(c)) return { id: 'store-grep', msg: storeMsg(c) };

  // RULE 2 — discovery search of the source tree belongs to the code graph.
  if (isSearch) {
    const args = (gitGrep ? tok.slice(2) : tok.slice(1)).filter((a) => !a.startsWith('-'));
    const targetsOneFile = args.some((a) => FILEISH.test(a)); // a concrete file = "you know where"
    const recursive = RECURSIVE_FLAG.test(c) || tool === 'rg' || tool === 'ag' || tool === 'ack' || gitGrep;
    if (recursive && !targetsOneFile) return { id: 'source-discovery', msg: graphMsg(c) };
  }
  // find/gci that LOCATES files (-name/-path/-recurse) is discovery too.
  if (isFind && /(?:^|\s)(?:-i?name\b|-i?path\b|-recurse\b)/i.test(c)) return { id: 'source-discovery', msg: graphMsg(c) };

  return null;
}

function storeMsg(c) {
  return [
    '',
    'BLOCKED: searching the .ai work store with a text tool.',
    `  ${trunc(c)}`,
    '',
    'Query the work graph instead — it knows the links/history a grep is blind to:',
    `  node "${Q}" governing <path>     # OPEN tickets/decisions governing a file`,
    `  node "${Q}" trail <id>           # walk UP an id to its governing decisions/origin`,
    `  node "${Q}" fts <terms...>       # full-text search title+body across stores`,
    `  node "${Q}" open [scope]         # open items (todo|doing|review)`,
    `  node "${Q}" doc-trail <id>       # an item's history, newest first`,
    `  node "${Q}" --help               # the full query surface`,
    '',
    'This gate is the enforcement, not memory. (Read the q output, not the files.)',
    '',
  ].join('\n');
}

function graphMsg(c) {
  return [
    '',
    'BLOCKED: grepping the source tree to discover code.',
    `  ${trunc(c)}`,
    '',
    'Query the code graph FIRST — it resolves imports/symbols/surface without opening files:',
    `  node "${GRAPH}" --query importers-of <path>   # who imports X`,
    `  node "${GRAPH}" --query defines <symbol>       # where Y is defined`,
    `  node "${GRAPH}" --query surface <path>         # a module's public surface`,
    '',
    'For a TARGETED look once you know the file, use the Grep/Glob/Read tools',
    '(not Bash grep). A bare `grep <pattern> <one-specific-file>` is allowed.',
    '',
  ].join('\n');
}

const trunc = (s) => (s.length > 120 ? s.slice(0, 117) + '...' : s);
