// Assemble the ticket-DETAIL DTO (camelCase) from the cache rows. Frontmatter fields come from
// the items row + the links edge table; description/AC/Notes from the stored body; History from
// the materialized history table; comments (with @mention + per-agent unread state) via
// comments.mjs — the SAME parser the CLI/drain read receipts through, so the API and the agent
// see one truth. read-receipts live under the project's .ai (root); a central-only project
// (root null) reads as "no acks" (fail-open), so mentions simply surface as unread.

import { parseComments, buildRef, readReceipts, isAcked } from '../../scripts/comments.mjs';
import { parseTicketBody } from './ticket-parse.mjs';

function mapLinks(links) {
  return links.map((l) => ({ rel: l.rel, to: l.to_id }));
}

function mapComments(id, body, root, agent) {
  const receipts = readReceipts(root || '');
  return parseComments(body).map((c) => {
    const ref = buildRef(id, c.ordinal);
    const mentionsAgent = c.mentions.some((m) => m.toLowerCase() === agent.toLowerCase());
    return {
      ref,
      ordinal: c.ordinal,
      ts: c.ts,
      author: c.author,
      text: c.text,
      mentions: c.mentions,
      mentionsAgent,
      unread: mentionsAgent && !isAcked(receipts, ref, agent),
    };
  });
}

// `row` is the { item, body, history, links } shape from cache-read.fetchTicket. `remoteUrl` is the
// project's origin web base (KIT-T148) so the client can turn a commit-sha chip into a permalink.
export function buildTicketDetail(row, { root, agent, remoteUrl = null }) {
  const { item, body, history, links } = row;
  const sections = parseTicketBody(body);
  return {
    id: item.id,
    scope: item.scope,
    type: item.type,
    status: item.status,
    priority: item.priority,
    title: item.title,
    milestone: item.milestone || null,
    parent: item.parent || null,
    archived: !!item.archived,
    remoteUrl,
    links: mapLinks(links),
    description: sections.description,
    acceptanceCriteria: sections.acceptanceCriteria,
    notes: sections.notes,
    history: history.map((h) => ({ ts: h.ts, event: h.event, detail: h.detail })),
    comments: mapComments(item.id, body, root, agent),
  };
}
