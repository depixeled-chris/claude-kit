// GET /api/me — the resolved viewer identity (KIT-T145): { alias }. The UI fetches this once and
// derives the comment-author default, the status agent, and the mention viewer from it, so no
// personal name is ever a literal in the client. The alias comes from the same resolver the CLI
// and write endpoints use (scripts/identity.resolveUser).

import { Router } from 'express';
import { asyncHandler, send } from '../lib/respond.mjs';
import { resolveUser } from '../../scripts/identity.mjs';

export function meRoutes() {
  const router = Router();
  router.get('/', asyncHandler(async (req, res) => {
    send(res, { alias: resolveUser() });
  }));
  return router;
}
