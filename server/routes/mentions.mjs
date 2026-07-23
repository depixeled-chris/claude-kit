// The /api/mentions surface (KIT-T146): the cross-project @mention inbox for the resolved user,
// plus per-mention and mark-all-read acks. Reads scan the markdown stores live; acks route through
// the t.mjs code path (durable receipt). Thin handlers — the service owns the scan + write logic.

import { Router } from 'express';
import { asyncHandler, send } from '../lib/respond.mjs';
import { collectMentions, ackMention, ackAllMentions } from '../services/mentions.mjs';

export function mentionsRoutes(config) {
  const router = Router();

  router.get('/', asyncHandler(async (req, res) => {
    const agent = req.query.agent ? String(req.query.agent) : undefined;
    const { agent: resolved, unreadCount, mentions } = collectMentions(config, agent);
    send(res, { agent: resolved, unreadCount, mentions }, { count: mentions.length, unreadCount });
  }));

  router.post('/ack', asyncHandler(async (req, res) => {
    const { projectKey, ref, agent } = req.body || {};
    const data = ackMention(config, { projectKey, ref, agent });
    send(res, data, { written: true });
  }));

  router.post('/ack-all', asyncHandler(async (req, res) => {
    const { agent } = req.body || {};
    const data = ackAllMentions(config, agent);
    send(res, data, { written: true });
  }));

  return router;
}
