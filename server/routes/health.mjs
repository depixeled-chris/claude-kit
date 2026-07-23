// GET /health — liveness + a cache-freshness read (verifyCache, the same manifest self-check
// the CLI's `q verify` runs). Never throws: a cache probe failure still reports the server up.

import { Router } from 'express';
import { verifyCache } from '../../scripts/q.mjs';
import { asyncHandler, send } from '../lib/respond.mjs';

export function healthRoutes(config) {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    let cacheFresh = null;
    try {
      const result = await verifyCache(config.hydrateRoot, config.dbPath);
      cacheFresh = !result.stale;
    } catch {
      cacheFresh = null; // probe failed — liveness is unaffected
    }
    send(res, { status: 'ok', cacheFresh });
  }));
  return router;
}
