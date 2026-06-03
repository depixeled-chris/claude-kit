#!/usr/bin/env node
// Stop — the request-capture ratchet (KIT-T005 design; the failure it fixes: an
// accepted request carried in the model's head, then buried by a pivot, never logged).
//
// Requests have no natural choke point the way `git commit` does (commit-gate.mjs),
// so we manufacture one here: every assistant turn ends at Stop. If the last user
// message looks like an actionable request and NOTHING was captured this turn, block
// the stop ONCE with a nudge. The burden flips from "remember to log" to "clear the gate".
//
// Rigid but loop-proof: `stop_hook_active` means we already nudged this stop → allow.
// Release valves: a receipt token (or a "[no-capture: reason]") in the reply, OR any
// new/changed file in the .ai capture stores this turn. Fail-open on every error.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, adopted, payload } from './lib.mjs';

// Built-in defaults — overridable/extendable via `capture.signals` in .ai/config.yml.
const DEFAULT_SIGNALS = [
  "i'?d like", "can you (add|make|build|create|write|set ?up)", "could you (add|make|build|create)",
  "we should", "you should (add|make|build)", "in the future", "eventually", "down the (road|line)",
  "don'?t forget", "it would be (nice|good|great)", "let'?s\\b.*\\blater\\b", "remember to",
  "at some point", "would be (nice|good|worth)", "needs? to be (a )?(ticket|tracked|captured|logged)",
];

// A reply satisfies the gate if it carries a routing receipt or an explicit dismissal.
const RECEIPT = /\[no-?capture\b|(?:→|->)\s*[^\n]*\b(logged|filed|captured|routed|recorded|opened|amended)\b|\b[A-Z]{2,}-[A-Z]\d{1,4}\b[^\n]*\b(logged|filed|captured|recorded|amended|created|opened)\b/i;

const STORES = ['inbox', 'tickets', 'decisions', 'questions', 'notes'];
const NON_CAPTURE = /^(README|_TEMPLATE|INDEX|REGRESSIONS)\b/i;

main().catch(() => process.exit(0)); // any failure → allow the stop (fail-open)

async function main() {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0);              // already nudged this stop — never loop
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const cfg = loadCapture(root);
  if (cfg.enabled === false) process.exit(0);

  const tx = p.transcript_path;
  if (!tx || !existsSync(tx)) process.exit(0);

  const { lastUser, lastAssistant, turnStartMs } = parseTranscript(tx);
  if (!lastUser) process.exit(0);

  const hit = cfg.signals.find((re) => re.test(lastUser));
  if (!hit) process.exit(0);                            // not request-shaped

  if (RECEIPT.test(lastAssistant || '')) process.exit(0);          // captured/dismissed in the reply
  if (turnStartMs && capturedSince(root, turnStartMs)) process.exit(0); // captured to a store

  const quote = lastUser.replace(/\s+/g, ' ').trim().slice(0, 120);
  process.stderr.write(
    `⚠ Possible un-captured request: "${quote}"\n` +
    `Route it (cap / a ticket / a decision) or add "[no-capture: reason]" to your reply, then stop.\n`
  );
  process.exit(cfg.mode === 'warn' ? 0 : 2);            // block-once (rigid) unless mode: warn
}

// --- transcript ---------------------------------------------------------------

function parseTranscript(file) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return {};
  }
  let lastUser = null, lastAssistant = null, turnStartMs = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const role = e?.type || e?.message?.role;
    const content = e?.message?.content;
    if (!lastAssistant && role === 'assistant') {
      lastAssistant = extractText(content);
      continue;
    }
    if (!lastUser && role === 'user' && !isToolResult(content)) {
      const text = extractText(content);
      if (text && text.trim()) {
        lastUser = text;
        turnStartMs = Date.parse(e?.timestamp || '') || 0;
      }
    }
    if (lastUser && lastAssistant) break;
  }
  return { lastUser, lastAssistant, turnStartMs };
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text).join('\n');
  }
  return '';
}

function isToolResult(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
}

// --- "did this turn capture anything?" ----------------------------------------

function capturedSince(root, ms) {
  const tol = ms - 1500; // small clock skew tolerance
  for (const store of STORES) {
    const dir = join(root, '.ai', store);
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.md') || NON_CAPTURE.test(n)) continue;
      try {
        if (statSync(join(dir, n)).mtimeMs >= tol) return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}

// --- config (tolerant scan; no YAML dep, mirroring lib.mjs's approach) ---------

function loadCapture(root) {
  const out = { enabled: true, mode: 'block-once', signals: compile(DEFAULT_SIGNALS) };
  let text;
  try { text = readFileSync(join(root, '.ai', 'config.yml'), 'utf8'); } catch { return out; }
  const block = text.match(/^capture:[ \t]*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return out;
  const body = block[1];
  if (/^\s*enabled:\s*false\b/m.test(body)) out.enabled = false;
  const mode = body.match(/^\s*mode:\s*["']?([a-z-]+)/m);
  if (mode) out.mode = mode[1];
  const sig = body.match(/^\s*signals:[ \t]*\n((?:\s*-\s*.*\n?)+)/m);
  if (sig) {
    const list = [...sig[1].matchAll(/^\s*-\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]);
    if (list.length) out.signals = compile(list);
  }
  return out;
}

function compile(patterns) {
  const res = [];
  for (const p of patterns) {
    try { res.push(new RegExp(p, 'i')); } catch { /* skip a bad pattern, keep the rest */ }
  }
  return res;
}
