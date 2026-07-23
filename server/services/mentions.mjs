// Cross-project @mention inbox (KIT-T146). Every comment across EVERY discovery project that
// @mentions the resolved user (KIT-T145) surfaces here, each tagged with its project, ticket ref,
// and unread (un-acked) state — so agent hand-offs addressed to the maintainer are one place away
// instead of buried per-ticket. The markdown scan IS the source (comment bodies + the ack sidecar
// aren't in the SQLite cache), the same basis q.mjs mentions and orient read. Acks ride the t.mjs
// `ack` path so a receipt written here is byte-identical to a CLI ack and survives across machines.

import { collectItems } from '../../scripts/db-parse.mjs';
import { mentionsForAgent, readReceipts } from '../../scripts/comments.mjs';
import { resolveUser } from '../../scripts/identity.mjs';
import { ack as tAck } from '../../scripts/t.mjs';
import { readDisplayName, resolveProject } from './discovery.mjs';
import { ApiError } from '../lib/errors.mjs';
import { STATUS } from '../lib/status.mjs';

const EXCERPT_MAX = 240;
function excerpt(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > EXCERPT_MAX ? `${t.slice(0, EXCERPT_MAX - 1)}…` : t;
}

// Every @mention of `agent` across all projects, unread first then newest, plus the unread count.
export function collectMentions(config, agentArg) {
  const agent = (agentArg && String(agentArg).trim()) || resolveUser();
  const mentions = [];
  for (const p of config.discovery.listProjects()) {
    let items;
    let receipts;
    try {
      items = collectItems(p.root || null, p.aiDir);
      receipts = readReceipts(p.root || ''); // central-only (no root) → no acks: everything unread
    } catch {
      continue; // one unreadable project store never sinks the whole inbox
    }
    const projectName = readDisplayName(p.aiDir, p.key);
    for (const m of mentionsForAgent(items, receipts, agent)) {
      mentions.push({
        projectKey: p.key,
        projectName,
        writable: !!p.root,
        id: m.id,
        ref: m.ref,
        ordinal: m.ordinal,
        author: m.author,
        ts: m.ts,
        excerpt: excerpt(m.text),
        unread: !m.acked,
      });
    }
  }
  // Unread first; within a state, newest timestamp first (string-ISO compare).
  mentions.sort((a, b) => Number(b.unread) - Number(a.unread) || String(b.ts).localeCompare(String(a.ts)));
  return { agent, unreadCount: mentions.filter((m) => m.unread).length, mentions };
}

// Ack ONE mention (write a per-agent read receipt via the t.mjs code path).
export function ackMention(config, { projectKey, ref, agent: agentArg }) {
  const agent = (agentArg && String(agentArg).trim()) || resolveUser();
  if (!ref || !String(ref).trim()) throw new ApiError(STATUS.BAD_REQUEST, 'ref is required (<id>#<ordinal>)', 'bad_request');
  const project = resolveProject(config.discovery, projectKey); // throws typed 404 on unknown key
  if (!project.root) {
    throw new ApiError(STATUS.CONFLICT, `project '${project.key}' has no local repo here — acks are not writable`, 'not_writable');
  }
  let result;
  try {
    result = tAck(project.root, ref, { agent });
  } catch (e) {
    throw new ApiError(STATUS.BAD_REQUEST, (e && e.message) || String(e), 'ack_failed');
  }
  return { projectKey: project.key, ref: result.ref, agent: result.agent, already: result.already };
}

// Ack EVERY unread mention for the agent across projects (mark-all-read). Central-only projects
// (no writable root) can't persist a receipt, so their mentions are reported as `skipped`.
export function ackAllMentions(config, agentArg) {
  const agent = (agentArg && String(agentArg).trim()) || resolveUser();
  const { mentions } = collectMentions(config, agent);
  const byKey = new Map(config.discovery.listProjects().map((p) => [p.key, p]));
  let acked = 0;
  let skipped = 0;
  for (const m of mentions) {
    if (!m.unread) continue;
    const p = byKey.get(m.projectKey);
    if (!p || !p.root) { skipped++; continue; }
    try { tAck(p.root, m.ref, { agent }); acked++; } catch { skipped++; }
  }
  return { agent, acked, skipped };
}
