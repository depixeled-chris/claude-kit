#!/usr/bin/env node
// PreCompact + Stop — keep the resume ANCHOR (SESSION.md) durable, so a /clear at any point
// loses nothing (KIT-D015 / KIT-T014).
//
//  • PreCompact: remind to flush durable state before context (and detail) is lost. The
//    post-compaction SessionStart (orient) re-surfaces the record. Also surfaces un-triaged
//    inbox items so captured-but-unrouted requests don't die at the context boundary.
//  • Stop: the SESSION-anchor ratchet (mirrors request-gate). SESSION.md is only reliably
//    written at PreCompact, so a mid-work /clear resumes from a stale anchor. This nudges ONCE
//    when meaningful work landed THIS turn (a commit, or a write under .ai/) but SESSION.md
//    wasn't touched — flipping the burden from "remember to flush" to "clear the gate".
//
// No-ops on unadopted repos. FAIL-OPEN everywhere: a durability hook must never wedge a session
// or block a /clear (the hook contract), so every path exits 0.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot, adopted, git, payload, sessionMtimeMs } from './lib.mjs';

// A commit whose subject lands within this slack of the turn start counts as "this turn" — the
// same small clock-skew tolerance the request-gate uses for store mtimes.
const TURN_SKEW_MS = 1500;
const MS_PER_SEC = 1000; // git %ct is epoch SECONDS; compare in ms
// Stores whose writes count as "meaningful work this turn" for the anchor nudge: the durable
// record (tickets/decisions/notes/questions). inbox is EXCLUDED — a frictionless capture isn't
// the substantive work the anchor must track, and counting it would hold the gate open on a
// turn that only jotted an idea.
const WORK_STORES = ['tickets', 'decisions', 'notes', 'questions'];

main().catch(() => process.exit(0)); // any failure → allow (fail-open)

async function main() {
  const p = await payload();
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  if (p.hook_event_name === 'Stop') {
    stopAnchorNudge(root, p);
  } else {
    precompactReminder(root);
  }
  process.exit(0);
}

// --- PreCompact: flush reminder -------------------------------------------------

function precompactReminder(root) {
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
- In-flight delegated agents -> recorded in ${join(root, '.ai', 'agents.jsonl')} (orient replays them)
- Work in flight -> the plan-of-record / its ticket${inboxNote}
After compaction, trust .ai/ + git (${branch}@${head}) over the summary.
=========================================================`);
}

// --- Stop: SESSION-anchor ratchet (mirrors request-gate.mjs) --------------------

function stopAnchorNudge(root, p) {
  if (p.stop_hook_active) return;                 // already nudged this stop — never loop
  const tx = p.transcript_path;
  if (!tx || !existsSync(tx)) return;             // can't bound the turn — stay silent (fail-open)

  const turnStartMs = lastUserTurnMs(tx);
  if (!turnStartMs) return;

  // Did SESSION.md get touched THIS turn? If so, the anchor is current — gate satisfied.
  if (sessionMtimeMs(root) >= turnStartMs - TURN_SKEW_MS) return;

  // Otherwise, did meaningful work land this turn? Only nag when there's actually fresh work an
  // anchor should point at — a no-op turn (just chatting) must stay silent.
  const work = workSince(root, turnStartMs);
  if (!work) return;

  process.stderr.write(
    `⚠ SESSION.md is the resume anchor and wasn't updated this turn, but ${work} landed.\n` +
    `Flush .ai/SESSION.md (current state + next steps) so a /clear here loses nothing, then stop.\n`,
  );
  process.exit(2);                                 // block-once (rigid) — same ratchet as request-gate
}

// "This turn" = since the last real user message (the request-gate's definition). Returns its
// timestamp ms, or 0 when none is found.
function lastUserTurnMs(file) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return 0;
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const role = e?.type || e?.message?.role;
    if (role !== 'user' || e?.isMeta === true) continue;
    const content = e?.message?.content;
    if (Array.isArray(content) && content.some((b) => b && b.type === 'tool_result')) continue;
    const text = extractText(content);
    if (text && text.trim() && !isSystemNotice(text)) return Date.parse(e?.timestamp || '') || 0;
  }
  return 0;
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}

function isSystemNotice(text) {
  return /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i.test(text);
}

// What meaningful work landed since `ms`? A short label naming the first kind found (a commit
// authored this turn, or a write into a durable .ai store), else '' for "nothing to anchor".
function workSince(root, ms) {
  const tol = ms - TURN_SKEW_MS;
  // A commit whose author-time is at/after the turn start. (Local commits are the canonical
  // "work landed" signal; the gate exists precisely so the anchor tracks them.)
  const lastCommit = git(['-C', root, 'log', '-1', '--format=%ct']).trim();
  if (lastCommit && Number(lastCommit) * MS_PER_SEC >= tol) return 'a commit';
  // A durable store write this turn (a ticket/decision/note/question file changed).
  for (const store of WORK_STORES) {
    const dir = join(root, '.ai', store);
    let names;
    try { names = readdirSync(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.md') || /^(README|_TEMPLATE|INDEX|REGRESSIONS|SUPERSEDED)\b/i.test(n)) continue;
      try { if (statSync(join(dir, n)).mtimeMs >= tol) return `a ${store} edit`; } catch { /* ignore */ }
    }
  }
  return '';
}
