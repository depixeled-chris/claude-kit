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
import { gitRoot, adopted, payload, pathExcluded, excludeFooter, loadCaptureConfig, ID_CITE_SRC } from './lib.mjs';

// Built-in defaults — overridable/extendable via `capture.signals` in .ai/config.yml.
// Two families: polite/future asks AND blunt imperatives / bug reports / feel-tuning (the way
// a frustrated maintainer ACTUALLY reports — "there needs to be…", "X doesn't feel…",
// "the moon shouldn't be…", "too narrow", "no way to…", "fix the…"). Missing the blunt family
// is exactly why a real request slipped the gate. Tuned to avoid plain questions ("what does X do").
const DEFAULT_SIGNALS = [
  // polite / future asks
  "i'?d like", "can you (add|make|build|create|write|set ?up)", "could you (add|make|build|create)",
  "we should", "you should (add|make|build)", "in the future", "eventually", "down the (road|line)",
  "don'?t forget", "it would be (nice|good|great)", "let'?s\\b.*\\blater\\b", "remember to",
  "at some point", "would be (nice|good|worth)",
  // blunt imperatives / bug reports / feel-tuning
  "there (needs?|should|has|have|is|are|'?s)\\b", "needs? to (be|have|feel|look|work|render|exist)",
  "should(n'?t)? (be|have|feel|look|render|work|exist)", "do(es)? ?(n'?t| not) (feel|look|work|render|line up|match|exist)",
  "is ?n'?t (working|right|correct|enough)", "too (slow|fast|narrow|wide|small|big|dark|bright|short|tall|low|high|thin|sparse)\\b",
  "\\b(is|are) (too|way too|not)\\b", "\\b(is|are|seems?|looks?) broken\\b", "no (easy )?way to\\b",
  "needs? (a )?(fix|fixing|wider|widening|work)\\b", "fix (this|the|that|it|these|those)\\b",
  "make (it|them|the|this|these) ", "add (a|an|the|some|more) ", "feels? (like|too|wrong|off)\\b",
  "should feel", "near .{0,16} enough\\b", "not .{0,16} enough\\b",
];

// A reply satisfies the gate if it carries a routing receipt or an explicit dismissal.
// The id atom is the shared ID_CITE_SRC (KIT-T059 — this regex previously accepted any
// [A-Z] type letter while commit-gate required [TDNQ]).
const RECEIPT = new RegExp(
  String.raw`\[no-?capture\b|(?:→|->)\s*[^\n]*\b(logged|filed|captured|routed|recorded|opened|amended)\b|\b${ID_CITE_SRC}\b[^\n]*\b(logged|filed|captured|recorded|amended|created|opened)\b`,
  'i',
);

// The file-valve counts only NEW frictionless captures (the inbox — where `cap` writes). It
// deliberately does NOT count tickets/decisions/etc., because active work edits those EVERY
// turn (the active ticket), which would hold the valve permanently open and let a brand-new
// request slip — exactly the failure this fixes. Capturing straight to a ticket/decision
// instead releases via the receipt token in the reply (RECEIPT).
const CAPTURE_STORES = ['inbox'];
const NON_CAPTURE = /^(README|_TEMPLATE|INDEX|REGRESSIONS)\b/i;

main().catch(() => process.exit(0)); // any failure → allow the stop (fail-open)

async function main() {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0);              // already nudged this stop — never loop
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const cfg = loadCaptureConfig(root, DEFAULT_SIGNALS);
  if (cfg.enabled === false) process.exit(0);
  // KIT-T051: a repo-wide exclusion (a glob covering the .ai store under `request-capture`
  // or '*') disables this process gate, mirroring `capture.enabled: false`.
  if (pathExcluded(root, 'request-capture', '.ai/inbox')) process.exit(0);

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
    `Route it (cap / a ticket / a decision) or add "[no-capture: reason]" to your reply, then stop.\n` +
    excludeFooter('request-capture')
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
    if (!lastUser && role === 'user' && !isToolResult(content) && e?.isMeta !== true) {
      const text = extractText(content);
      if (text && text.trim() && !isSystemNotice(text)) {
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

// Harness-injected user-role notices (background-task completions, system notifications,
// reminders, the gate's own echoed feedback) are NOT maintainer requests. The PRIMARY guard
// is the transcript's own `isMeta: true` flag (set on slash-command/skill expansions, the
// local-command caveat, and stop-hook feedback — every injected user-role entry). This text
// match is a fail-safe for the rare entry that lacks the flag. The bug it closes: a `cap`/
// `standup` skill prompt ("Classify and route the following…") is request-shaped, so when it
// was treated as the last user message it tripped the gate on the skill's OWN instructions.
function isSystemNotice(text) {
  return /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i.test(text);
}

// --- "did this turn capture anything?" ----------------------------------------

function capturedSince(root, ms) {
  const tol = ms - 1500; // small clock skew tolerance
  for (const store of CAPTURE_STORES) {
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

// Config parsing lives in lib.loadCaptureConfig (KIT-T059) — one home for every
// tolerant YAML-subset scanner.
