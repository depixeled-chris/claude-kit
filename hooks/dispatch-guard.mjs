#!/usr/bin/env node
// PreToolUse (Task|Agent) — enforce the dispatch ladder on subagent delegations (KIT-T151).
// exit 2 = block, 0 = allow. No-ops on unadopted repos; FAIL-OPEN everywhere else.
//
// WHY: the ladder (KIT-D035/D042/D043) routes delegations DOWN — coding/research → opus,
// trivial chores → haiku, fable reserved for orchestration + the hardest reasoning. But the
// Agent tool's default is "inherit the session model", so on a fable main thread every
// model-less delegation silently runs on the most expensive tier. Lived failure (2026-07-23,
// groovegrid): five researcher delegations inherited fable and burned ~105k subagent tokens
// before the miss was caught. Compliance was memory-dependent; this gate makes it structural.
//
// BLOCKS exactly the failure mode — the SILENT INHERIT: no model on the call, no `model:`
// pin in the agent's definition, and the latest assistant turn in the session transcript is
// fable. An EXPLICIT model on the call (fable included) always passes: an explicit tier is a
// visible, deliberate choice, and the config's own deep tier (dispatch.tiers) dispatches
// tickets with model:'fable' explicitly — the gate must not fight the ladder it enforces.
// ALLOWS: any explicit model; a definition that pins a tier (kit agents pin opus);
//   indeterminate parent model (cannot prove a fable inherit — fail open).
// ESCAPE: inline [allow-fable: <reason>] in the delegation prompt, or CLAUDE_KIT_ALLOW_FABLE=1
//   (keeps a deliberate model-less fable delegation possible without naming a tier).

import { readFileSync, statSync, openSync, readSync, closeSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';

const CHECK_ID = 'dispatch-ladder';
const TRANSCRIPT_TAIL_BYTES = 256 * 1024; // enough JSONL tail to find the latest assistant turn
const DEFINITION_HEAD_BYTES = 4 * 1024; // frontmatter lives at the top of an agent .md

try {
  const p = await payload();
  const input = p.tool_input || {};
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  if (pathExcluded(root, CHECK_ID, root)) process.exit(0);

  const prompt = String(input.prompt || '');
  const escaped =
    /\[allow-fable\b/i.test(prompt) ||
    /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_FABLE || '');
  if (escaped) process.exit(0);

  const isFable = (m) => /fable/i.test(String(m || ''));
  if (input.model) process.exit(0); // an explicit model IS the choice — any tier, fable included

  const pin = pinnedModel(root, String(input.subagent_type || ''));
  if (pin) process.exit(0); // the definition authored its tier
  const parent = latestAssistantModel(p.transcript_path);
  if (!isFable(parent)) process.exit(0); // cannot prove a fable inherit — fail open

  console.error(blockMessage(input.subagent_type, `no model on the call — inherits the fable session (${parent})`));
  process.exit(2);
} catch {
  process.exit(0);
}

// Resolve a `model:` pin from the agent definition's frontmatter. Probes the plugin's own
// agents/ (both install layouts), then project- and user-level .claude/agents/. A definition
// FOUND without a model line returns '' — an unpinned type must be routed explicitly.
function pinnedModel(root, subagentType) {
  const name = subagentType.split(':').pop().trim();
  if (!name) return '';
  const hookDir = dirname(fileURLToPath(import.meta.url));
  const probes = [
    process.env.CLAUDE_PLUGIN_ROOT && join(process.env.CLAUDE_PLUGIN_ROOT, 'agents', `${name}.md`),
    join(hookDir, '..', 'agents', `${name}.md`),
    root && join(root, '.claude', 'agents', `${name}.md`),
    join(homedir(), '.claude', 'agents', `${name}.md`),
  ].filter(Boolean);
  for (const file of probes) {
    try {
      if (!existsSync(file)) continue;
      const head = readFileSync(file, 'utf8').slice(0, DEFINITION_HEAD_BYTES);
      const fm = head.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const m = fm && fm[1].match(/^model:\s*([^\s#]+)/m);
      return m ? m[1] : '';
    } catch {
      /* unreadable probe — try the next layout */
    }
  }
  return '';
}

// The session's model = the latest assistant turn in the transcript JSONL. Indeterminate
// ('' → treated as not-fable) whenever the path is absent or unparseable.
function latestAssistantModel(transcriptPath) {
  try {
    if (!transcriptPath || !existsSync(transcriptPath)) return '';
    const size = statSync(transcriptPath).size;
    const start = Math.max(0, size - TRANSCRIPT_TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    const fd = openSync(transcriptPath, 'r');
    readSync(fd, buf, 0, buf.length, start);
    closeSync(fd);
    const lines = buf.toString('utf8').split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const row = JSON.parse(line);
        const model = row && row.type === 'assistant' && row.message && row.message.model;
        if (model) return model;
      } catch {
        /* clipped first line of the tail — keep scanning */
      }
    }
  } catch {
    /* unreadable transcript — indeterminate */
  }
  return '';
}

function blockMessage(subagentType, cause) {
  return [
    'BLOCKED: this delegation would run on fable — the orchestration tier.',
    `  agent: ${subagentType || '(default)'}   cause: ${cause}`,
    '',
    'The dispatch ladder (KIT-D035/D042/D043): coding/implementation/research -> opus;',
    'trivial mechanical chores -> haiku; fable is for orchestration + the hardest',
    'reasoning only — and must be CHOSEN, never inherited.',
    '',
    "Fix: pass an explicit model on the Agent call — model:'opus' (or 'haiku'), or",
    "model:'fable' if this genuinely needs the top tier — or delegate to a kit agent",
    '(researcher/code-reviewer/refactorer/test-author — they pin opus in frontmatter).',
    'To keep a model-less fable inherit: include [allow-fable: <reason>] in the prompt.',
    '',
    excludeFooter(CHECK_ID),
  ].join('\n');
}
