#!/usr/bin/env node
// PreToolUse (Bash) — block a `git commit` of code that isn't tied to the
// plan-of-record / a ticket. exit 2 = block, 0 = allow. No-ops on unadopted repos.

import { payload, git, gitRoot, adopted } from './lib.mjs';

const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);

const p = await payload();
const command = (p.tool_input && p.tool_input.command) || '';
if (!command.includes('git commit')) process.exit(0);

const root = gitRoot();
if (!adopted(root)) process.exit(0);

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const changed = [
  ...new Set([
    ...lines(git(['-C', root, 'diff', '--name-only', 'HEAD'])),
    ...lines(git(['-C', root, 'diff', '--cached', '--name-only'])),
    ...lines(git(['-C', root, 'ls-files', '--others', '--exclude-standard'])),
  ]),
];
if (!changed.length) process.exit(0);

// Plan-of-record part of the change? (root or .ai/ ROADMAP/DECISIONS, or a ticket)
if (changed.some((f) => /(^|\/)(ROADMAP|DECISIONS)\.md$/i.test(f) || /\.ai\/tickets\//.test(f))) {
  process.exit(0);
}
// Commit cites a logged item, or explicitly overrides? R### · T-### / DEC-### / D-### · [no-log:]
if (/\bR\d{2,}\b|\bT-\d+\b|\bD(?:EC)?-\d+\b|\[no-log/.test(command)) process.exit(0);

// Does the change actually touch code? (docs/config-only commits are fine)
const touchesCode = changed.some((f) => CODE.has((f.split('.').pop() || '').toLowerCase()));
if (!touchesCode) process.exit(0);

process.stderr.write(
  [
    '',
    'BLOCKED: this commit changes code but does not touch the plan-of-record.',
    '',
    'Before committing, do ONE of:',
    '  - update the plan-of-record (ROADMAP / a .ai/ticket) in this commit, or',
    '  - record a decision in DECISIONS, or',
    "  - cite the item in the message (e.g. 'implements R041' / 'T-007'), or",
    "  - if genuinely not trackable work, include '[no-log: <reason>]'.",
    '',
    'Unlogged work is lost across sessions. This gate is the enforcement, not memory.',
    '',
  ].join('\n'),
);
process.exit(2);
