#!/usr/bin/env node
// Stop — the LANDING ALERT ratchet (KIT-T021; KIT-D017's loop, pairs with KIT-T019).
//
// A rigid, structural part of the loop: whenever real work LANDS, the maintainer is ALWAYS
// alerted — never silent. "Lands" = a commit this turn (and, once pushed, that it's pushed/
// building, distinct from merely committed-local). The alert states WHAT landed, the TICKET it
// cites, and a LINK (the remote commit url). Like the commit-gate, this is enforced, not memory:
// every assistant turn ends at Stop, so we manufacture the choke point here — if work landed this
// turn and the reply doesn't already carry the landing receipt, block the stop ONCE with the
// alert. The burden flips from "remember to announce the landing" to "clear the gate".
//
// Loop-proof + once-per-landing: `stop_hook_active` (already nudged this stop) → allow; a marker
// keyed on the landed { head, pushed } state dedups so the SAME landing never re-alerts — but a
// STATE CHANGE (local commit → pushed/building) is a fresh landing worth its own alert. That is
// what distinguishes "pushed (building)" from "committed (not pushed)" across turns.
//
// Runs LAST on Stop (after sync-data pushes), so it observes the post-push state. FAIL-OPEN on
// every error: an alert hook must never wedge a session (the hook contract) → exit 0.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gitRoot, adopted, payload, git, wipSummary, remoteCommitUrl, ID_CITE_SRC, readTurnState, writeTurnState,
} from './lib.mjs';

// A commit whose subject lands within this slack of the turn start counts as "this turn" — the
// same small clock-skew tolerance request-gate/flush use for their turn bounding.
const TURN_SKEW_MS = 1500;
const MS_PER_SEC = 1000; // git %ct is epoch SECONDS; the turn start is ms
// Cap how many landed commits we enumerate, so a turn that lands a long series stays one screen;
// the rest collapse to a "+N more" tail.
const MAX_LISTED = 8;

// Code extensions whose presence makes a commit "real work" (vs docs/config-only noise). Kept in
// lock-step with commit-gate.mjs's CODE set — the SAME "does this commit touch code?" question the
// gate already answers, so the alert fires on exactly the commits the gate considers trackable.
const CODE = new Set(
  'ts tsx js jsx mjs cjs rs py go java rb php cs swift kt c cc cpp cxx h hpp css scss sass less vue svelte sql'.split(' '),
);

// The id-citation atom, shared (KIT-T059). A landed commit citing a ticket is real work even when
// it touches no code file (e.g. a pure plan-of-record / .ai store change with a citation). `CITE`
// is non-global (a stateless boolean test); `CITE_ALL` extracts every id for the "ticket" field.
const CITE = new RegExp(ID_CITE_SRC);
const CITE_ALL = new RegExp(ID_CITE_SRC, 'g');
// Recent commits scanned for the turn window — generous enough to cover a burst of landings, small
// enough to stay cheap; older ones are filtered out by author-time anyway.
const LOG_DEPTH = 50;

// The reply already told the maintainer the work landed → the alert is satisfied (the release
// valve, mirroring request-gate's RECEIPT). Any of: a landing verb (landed/pushed/deployed/live/
// shipped/committed), a short sha (7-40 hex), a commit-url, or an explicit [no-alert: reason].
const LANDED_RECEIPT = new RegExp(
  String.raw`\[no-?alert\b` +
    String.raw`|\b(?:landed|pushed|deployed|shipped|published|went live|is live|now live)\b` +
    String.raw`|\bcommit(?:ted|s)?\b[^\n]*\b[0-9a-f]{7,40}\b` +
    String.raw`|/commit/[0-9a-f]{7,40}\b` +
    String.raw`|\b[0-9a-f]{7,40}\b[^\n]*\b(?:landed|pushed|deployed|shipped|committed)\b`,
  'i',
);

main().catch(() => process.exit(0)); // any failure → allow the stop (fail-open)

async function main() {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0); // already nudged this stop — never loop
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const tx = p.transcript_path;
  if (!tx || !existsSync(tx)) process.exit(0); // can't bound the turn — stay silent (fail-open)
  const { turnStartMs, lastAssistant } = parseTranscript(tx);
  if (!turnStartMs) process.exit(0);

  const landed = landedThisTurn(root, turnStartMs);
  if (!landed.length) process.exit(0); // nothing landed — silent

  const head = git(['-C', root, 'rev-parse', 'HEAD']).trim();
  const pushed = isPushed(root);
  // Dedup: the SAME (head, pushed) landing alerts once. A later turn that pushes the same head
  // flips `pushed` false→true, which is a NEW state → a fresh "now pushed/building" alert.
  if (alreadyAlerted(root, head, pushed)) process.exit(0);

  // The reply already announced it → satisfied; still record the state so we don't re-alert later.
  if (LANDED_RECEIPT.test(lastAssistant || '')) {
    recordAlerted(root, head, pushed);
    process.exit(0);
  }

  recordAlerted(root, head, pushed);
  process.stderr.write(renderAlert(root, landed, pushed));
  process.exit(2); // block-once (rigid) — the same ratchet as request-gate / flush
}

// --- what landed this turn ------------------------------------------------------

// Commits authored at/after the turn start that are "real work" (touch code OR cite a ticket).
// Docs-only / [no-log:] commits are the "noise" KIT-T021 excludes. The author-time filter is done
// in JS (like flush.mjs) rather than via `git log --since`, so it doesn't depend on a recent git or
// on commits being in date order. Returns newest-first { sha, shortSha, subject, ids[] }.
function landedThisTurn(root, turnStartMs) {
  const tol = turnStartMs - TURN_SKEW_MS;
  const SEP = '\x1f'; // unit separator — safe inside a commit subject
  const raw = git(['-C', root, 'log', `--pretty=%H${SEP}%h${SEP}%ct${SEP}%s`, '-n', String(LOG_DEPTH)]);
  const out = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const [sha, shortSha, ct, subject = ''] = line.split(SEP);
    if (!sha || Number(ct) * MS_PER_SEC < tol) continue;
    if (!isRealWork(root, sha, subject)) continue;
    out.push({ sha, shortSha, subject, ids: [...new Set(subject.match(CITE_ALL) || [])] });
  }
  return out;
}

// A commit is real work iff it touches a code file OR cites a ticket id (matches the commit-gate's
// own notion of trackable work). A docs/config-only, un-cited commit is noise → not alerted.
function isRealWork(root, sha, subject) {
  if (CITE.test(subject)) return true;
  const files = git(['-C', root, 'show', '--name-only', '--pretty=format:', sha]).split('\n');
  return files.some((f) => CODE.has((f.split('.').pop() || '').toLowerCase()));
}

// Is HEAD on a remote tracking branch (pushed), or only local? wipSummary's unpushed list is the
// shared push-state source (D-010). A remote-less repo reports nothing unpushed → treated as
// "committed locally" (there is nowhere to push to, so we never falsely claim "pushed/building").
function isPushed(root) {
  if (!git(['-C', root, 'remote']).trim()) return false; // no remote → can't be pushed
  return wipSummary(root).unpushed.length === 0;
}

// --- the alert ------------------------------------------------------------------

function renderAlert(root, landed, pushed) {
  const state = pushed
    ? 'PUSHED (building) — confirm it is LIVE once the deploy completes'
    : 'COMMITTED locally — NOT pushed yet (push at the task boundary, then confirm)';
  const lines = ['', `⚑ LANDING ALERT — work landed this turn. Tell the maintainer WHAT + the ticket + the link.`, `  State: ${state}.`, ''];
  for (const c of landed.slice(0, MAX_LISTED)) {
    const url = pushed ? remoteCommitUrl(root, c.sha) : null;
    const cite = c.ids.length ? `  [${c.ids.join(', ')}]` : '';
    lines.push(`  • ${c.shortSha} ${c.subject}${cite}`);
    if (url) lines.push(`      ${url}`);
  }
  if (landed.length > MAX_LISTED) lines.push(`  • …+${landed.length - MAX_LISTED} more`);
  lines.push(
    '',
    'This alert is structural (KIT-T021), not optional. To clear the gate, either:',
    '  - announce the landing in your reply (what + ticket + link; say "pushed"/"deployed"/the sha), or',
    '  - if a deploy follows, confirm when it is LIVE (not just pushed), or',
    '  - if this genuinely should not alert, add "[no-alert: <reason>]".',
    '',
  );
  return lines.join('\n');
}

// --- once-per-landing marker (own turn-state slot; KIT-T021) ---------------------
// Stored in the 'land' slot so housekeeping's full-overwrite of the default turn-state object
// can't clobber it (the two Stop hooks would otherwise race on one file).
const SLOT = 'land';

function markerFor(head, pushed) {
  return `${head}:${pushed ? 'pushed' : 'local'}`;
}
function alreadyAlerted(root, head, pushed) {
  const st = readSlot(root);
  return !!st && st.alerted === markerFor(head, pushed);
}
function recordAlerted(root, head, pushed) {
  writeSlot(root, { alerted: markerFor(head, pushed) });
}

// Both slot accessors fail-open (a miss → no marker → the alert simply fires, the safe direction
// for "did we tell the maintainer?").
function readSlot(root) {
  return readTurnState(root, SLOT);
}
function writeSlot(root, state) {
  writeTurnState(root, state, SLOT);
}

// --- transcript (turn bounding — the request-gate/flush definition) -------------

function parseTranscript(file) {
  let lines;
  try {
    lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
  } catch {
    return {};
  }
  let turnStartMs = 0;
  let lastAssistant = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(lines[i]); } catch { continue; }
    const role = e?.type || e?.message?.role;
    const content = e?.message?.content;
    if (!lastAssistant && role === 'assistant') {
      lastAssistant = extractText(content);
      continue;
    }
    if (!turnStartMs && role === 'user' && e?.isMeta !== true && !isToolResult(content)) {
      const text = extractText(content);
      if (text && text.trim() && !isSystemNotice(text)) turnStartMs = Date.parse(e?.timestamp || '') || 0;
    }
    if (turnStartMs && lastAssistant) break;
  }
  return { turnStartMs, lastAssistant };
}

function extractText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('\n');
  }
  return '';
}
function isToolResult(content) {
  return Array.isArray(content) && content.some((b) => b && b.type === 'tool_result');
}
function isSystemNotice(text) {
  return /^\s*(?:<task-notification\b|<system-reminder\b|\[SYSTEM NOTIFICATION\b|Stop hook feedback:)/i.test(text);
}
