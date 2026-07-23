// The /api/projects surface — reads served from the cache, writes routed through the t.mjs
// code paths. Thin handlers: resolve the :key to a project, call a service, envelope the
// result. All async bodies go through asyncHandler so a thrown ApiError reaches the central
// handler as its typed status.

import { Router } from 'express';
import { asyncHandler, send } from '../lib/respond.mjs';
import { STATUS } from '../lib/status.mjs';
import { resolveProject } from '../services/discovery.mjs';
import { projectSummaries, listTickets, getTicketDetail, listStore } from '../services/projects.mjs';
import { postComment, setTicketStatus, setProjectDisplayName } from '../services/writes.mjs';

export function projectRoutes(config) {
  const router = Router();
  const project = (req) => resolveProject(config.discovery, req.params.key);

  router.get('/', asyncHandler(async (req, res) => {
    const data = await projectSummaries(config);
    send(res, data, { count: data.length });
  }));

  router.get('/:key/tickets', asyncHandler(async (req, res) => {
    const data = await listTickets(config, project(req), req.query.status);
    send(res, data, { count: data.length, status: req.query.status || null });
  }));

  router.get('/:key/tickets/:id', asyncHandler(async (req, res) => {
    const agent = req.query.agent ? String(req.query.agent) : undefined;
    const data = await getTicketDetail(config, project(req), req.params.id, agent);
    send(res, data, { cached: true });
  }));

  for (const store of ['questions', 'decisions', 'inbox', 'notes']) {
    router.get(`/:key/${store}`, asyncHandler(async (req, res) => {
      const data = await listStore(config, project(req), store);
      send(res, data, { count: data.length, store });
    }));
  }

  router.patch('/:key', asyncHandler(async (req, res) => {
    const { displayName } = req.body || {};
    const data = await setProjectDisplayName(project(req), displayName);
    send(res, data, { written: true });
  }));

  router.post('/:key/tickets/:id/comments', asyncHandler(async (req, res) => {
    const { text, author } = req.body || {};
    const data = await postComment(config, project(req), req.params.id, { text, author });
    send(res, data, { written: true }, STATUS.CREATED);
  }));

  router.post('/:key/tickets/:id/status', asyncHandler(async (req, res) => {
    const { status, agent } = req.body || {};
    const data = await setTicketStatus(config, project(req), req.params.id, { status, agent });
    send(res, data, { written: true });
  }));

  return router;
}
