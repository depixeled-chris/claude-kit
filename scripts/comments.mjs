// comments.mjs — the comment / @mention / read-receipt model for the .ai store (KIT-T130).
//
// A comment is a durable History `(comment)` event authored by someone. @mentions are DERIVED
// on read (regex over the comment TEXT, never persisted). Read receipts (per-agent acks) live
// in a committed JSON sidecar so an ack survives machines — operational state like agents.jsonl,
// not prose truth (KIT-D044). This module OWNS the on-disk shape so the WRITER (t.mjs) and the
// READERS (q.mjs, orient, drain) agree byte-for-byte: one concern, one home.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// A mention is `@handle` (word chars + hyphens). Derived on read from comment TEXT only.
const MENTION_RE = /@([\w-]+)/g;
export function deriveMentions(text) {
  return [...new Set([...String(text || '').matchAll(MENTION_RE)].map((m) => m[1]))];
}

// Compact-ISO timestamp (space -> T), matching db-parse.historyEvents so a comment's ts reads
// the same in the cache history table and in a stored ack record.
export function normTs(ts) {
  return String(ts || '').trim().replace(' ', 'T');
}

// A comment body spills to ## Notes when multi-line or longer than MAX_INLINE — the History
// line stays a single auditable event pointing at the Notes block by ordinal; the full prose
// (with any mentions on later lines) lives in Notes and is reconstructed on read.
const MAX_INLINE = 200;
const INLINE_CLIP = 120;

// One authored-comment History line: `- [ts] (comment) @author: text`. The `@author:` marker
// is what distinguishes a real comment from the incidental `(comment)` lines that tick/status
// append (those carry no `@handle:` prefix), so comment ordinals never count those.
const COMMENT_LINE_RE = /^[-*]\s*\[([^\]]+)\]\s*\(comment\)\s*@([\w-]+):[ \t]*(.*)$/;

// Notes spill block header: `### comment #N [ts] @author`, body until the next ##/### or EOF.
const SPILL_HEAD_RE = /^###\s+comment\s+#(\d+)\b/;

function extractSpills(src) {
  const map = new Map();
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(SPILL_HEAD_RE);
    if (!m) continue;
    const buf = [];
    let j = i + 1;
    for (; j < lines.length && !/^#{2,3}\s/.test(lines[j]); j++) buf.push(lines[j]);
    map.set(parseInt(m[1], 10), buf.join('\n').trim());
    i = j - 1;
  }
  return map;
}

// Every authored comment in a ticket body, oldest first, with mentions derived from the FULL
// text (the Notes spill reconstructed when the body was too long to inline). `ref` is the
// intra-ticket `#N`; a caller with the ticket id builds the store-wide `<id>#N` (buildRef).
export function parseComments(body) {
  const src = String(body || '');
  const spills = extractSpills(src);
  const out = [];
  let ordinal = 0;
  for (const line of src.split('\n')) {
    const m = line.match(COMMENT_LINE_RE);
    if (!m) continue;
    ordinal += 1;
    const ts = m[1].trim();
    const author = m[2];
    const text = spills.has(ordinal) ? spills.get(ordinal) : m[3].trim();
    out.push({ ordinal, ref: `#${ordinal}`, ts, tsKey: normTs(ts), author, text, mentions: deriveMentions(text) });
  }
  return out;
}

export const buildRef = (id, ordinal) => `${id}#${ordinal}`;

// The append pieces for a NEW comment: a one-line History event and (when the body spills) a
// Notes block. `ts` is supplied by the caller (t.mjs stamp()) so the timestamp format stays in
// ONE place. The ordinal is append-only — comment N is permanently comment N.
export function buildComment(body, { id, author, text, ts }) {
  const ordinal = parseComments(body).length + 1;
  const clean = String(text).replace(/\r\n?/g, '\n');
  const mentions = deriveMentions(clean);
  const base = { ordinal, ref: buildRef(id, ordinal), mentions };
  if (!clean.includes('\n') && clean.length <= MAX_INLINE) {
    return { ...base, historyLine: `- [${ts}] (comment) @${author}: ${clean}`, notesBlock: null };
  }
  const head = clean.split('\n')[0].slice(0, INLINE_CLIP);
  return {
    ...base,
    historyLine: `- [${ts}] (comment) @${author}: ${head} (full comment #${ordinal} in ## Notes)`,
    notesBlock: `### comment #${ordinal} [${ts}] @${author}\n${clean}`,
  };
}

// ---- read receipts (per-agent acks) ---------------------------------------
// A committed JSON sidecar under .ai/ — acked state that must survive a `/clear` and travel
// between machines with the repo. Fail-open: a missing or corrupt file reads as "no acks".

const RECEIPTS_FILE = 'read-receipts.json';
export const receiptsPath = (root) => join(root, '.ai', RECEIPTS_FILE);

export function readReceipts(root) {
  try {
    const data = JSON.parse(readFileSync(receiptsPath(root), 'utf8'));
    return Array.isArray(data.acks) ? data : { version: 1, acks: [] };
  } catch {
    return { version: 1, acks: [] };
  }
}

export const isAcked = (receipts, ref, agent) =>
  receipts.acks.some((a) => a.ref === ref && a.agent === agent);

export function recordAck(root, { ref, agent, ts }) {
  const receipts = readReceipts(root);
  if (isAcked(receipts, ref, agent)) return { ref, agent, already: true };
  receipts.acks.push({ ref, agent, ts: ts || '', at: new Date().toISOString() });
  writeFileSync(receiptsPath(root), JSON.stringify(receipts, null, 2) + '\n');
  return { ref, agent, already: false };
}

// ---- cross-ticket surfacing -----------------------------------------------
// Comments live on TICKETS; a comment's store-wide ref is `<ticket-id>#<ordinal>`.
export function collectComments(items) {
  const out = [];
  for (const it of items) {
    if (it.store && it.store !== 'tickets') continue;
    for (const c of parseComments(it.body)) {
      out.push({ id: it.id, ref: buildRef(it.id, c.ordinal), ordinal: c.ordinal, ts: c.ts, author: c.author, text: c.text, mentions: c.mentions });
    }
  }
  return out;
}

// Every comment mentioning `agent`, each tagged with its acked state (case-insensitive match).
// Callers that SURFACE (orient/drain) keep the unread ones; `q mentions` shows all with state.
export function mentionsForAgent(items, receipts, agent) {
  const lc = String(agent || '').toLowerCase();
  const out = [];
  for (const c of collectComments(items)) {
    if (!c.mentions.some((m) => m.toLowerCase() === lc)) continue;
    out.push({ ...c, agent, acked: isAcked(receipts, c.ref, agent) });
  }
  return out;
}

// The acting agent identity — who a session acts as when surfacing "your" unread mentions.
// Env-driven so a delegated agent can declare itself; defaults to `claude` for a plain session.
export function resolveAgent(env = process.env) {
  return (env.KIT_AGENT || env.CLAUDE_AGENT || '').trim() || 'claude';
}
