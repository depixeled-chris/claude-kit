// GET /api/waiting — the cross-project WAITING-ON-YOU board (survey.mjs data).

import { Router } from 'express';
import { asyncHandler, send } from '../lib/respond.mjs';
import { waitingBoard } from '../services/waiting.mjs';

export function waitingRoutes() {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    const data = waitingBoard();
    send(res, data, { count: data.length });
  }));
  return router;
}
