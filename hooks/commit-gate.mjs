#!/usr/bin/env node
// PreToolUse (Bash) — block a `git commit` of code that isn't tied to the
// plan-of-record / a ticket. exit 2 = block, 0 = allow. No-ops on unadopted repos.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { payload, git, gitRoot, adopted } from './lib.mjs';

const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);

const p = await payload();
const command = (p.tool_input && p.tool_input.command) || '';
if (!command.includes('git commit')) process.exit(0);

const root = gitRoot();
if (!adopted(root)) process.exit(0);
// Centralized data (D-008): the plan-of-record lives in claude-kit-data, not this repo,
// so it can't be touched in this commit — the gate is cite-only here.
const centralized = existsSync(join(root, '.claude-project'));

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const changed = [
  ...new Set([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
    ...lines(git(['-C', root, 'ls-files', '--others', '--exclude-standard'])),
  ]),
];
if (!changed.length) process.exit(0);

// Plan-of-record part of the change? A root/legacy ROADMAP|DECISIONS.md, or any of the
// atomic .ai/ stores (tickets/decisions/questions/notes/inbox — D-009).
if (changed.some((f) => /(^|\/)(ROADMAP|DECISIONS)\.md$/i.test(f) || /\.ai\/(tickets|decisions|questions|notes|inbox)\//.test(f))) {
  process.exit(0);
}
// Commit cites a logged item, or explicitly overrides? R### · T-### / DEC-### / D-### · [no-log:]
if (/\bR\d{2,}\b|\bT-\d+\b|\bD(?:EC)?-\d+\b|\[no-log/.test(command)) process.exit(0);

// Does the change actually touch code? (docs/config-only commits are fine)
const touchesCode = changed.some((f) => CODE.has((f.split('.').pop() || '').toLowerCase()));
if (!touchesCode) process.exit(0);

const blockedLine = centralized
  ? 'BLOCKED: code commit with no ticket citation (workflow data is centralized — D-008).'
  : 'BLOCKED: this commit changes code but does not touch the plan-of-record.';
const options = centralized
  ? [
      "  - cite the ticket in the message (e.g. 'implements R045' / 'T-007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ]
  : [
      '  - update the plan-of-record (ROADMAP / a .ai/ticket) in this commit, or',
      '  - record a decision in DECISIONS, or',
      "  - cite the item in the message (e.g. 'implements R041' / 'T-007'), or",
      "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    ];
process.stderr.write(
  ['', blockedLine, '', 'Before committing, do ONE of:', ...options, '', 'Unlogged work is lost across sessions. This gate is the enforcement, not memory.', ''].join('\n'),
);
process.exit(2);
