// The READ facade: composes discovery + the cache fetchers + the detail assembler into the
// DTOs the routes return. Opens the cache ONCE per request (dbOpen's staleness→rehydrate runs
// there) and shapes camelCase output. No SQL here — that is cache-read's concern.

import { resolveAgent } from '../../scripts/comments.mjs';
import { compareIds } from '../../scripts/id-utils.mjs';
import { withCache, fetchCounts, fetchTickets, fetchTicket, fetchStore } from './cache-read.mjs';
import { buildTicketDetail } from './ticket-detail.mjs';
import { readDisplayName } from './discovery.mjs';
import { notFound } from '../lib/errors.mjs';

const byId = (a, b) => compareIds(a.id, b.id);

// Every adopted project with its open/review counts (one cache open, one count query each).
export async function projectSummaries(config) {
  const projects = config.discovery.listProjects();
  return withCache(config, (handle) =>
    projects.map((p) => {
      const { open, review } = fetchCounts(handle, p.key);
      return {
        key: p.key,
        name: p.name,
        displayName: readDisplayName(p.aiDir, p.key),
        openCount: open,
        reviewCount: review,
      };
    }));
}

const ticketListItem = (r) => ({
  id: r.id, type: r.type, status: r.status, priority: r.priority, title: r.title, milestone: r.milestone || null,
});

export async function listTickets(config, project, status) {
  return withCache(config, (handle) =>
    fetchTickets(handle, project.key, status).map(ticketListItem).sort(byId));
}

export async function getTicketDetail(config, project, id, agent = resolveAgent()) {
  return withCache(config, (handle) => {
    const row = fetchTicket(handle, project.key, id);
    if (!row) throw notFound(`unknown ticket '${id}' in project '${project.key}'`);
    return buildTicketDetail(row, { root: project.root, agent });
  });
}

const storeItem = (r) => ({ id: r.id, type: r.type, status: r.status, title: r.title });

export async function listStore(config, project, store) {
  return withCache(config, (handle) =>
    fetchStore(handle, project.key, store).map(storeItem).sort(byId));
}
