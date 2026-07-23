// Serves the built UI (ui/dist) from the SAME process/port as the API, so the daily
// workflow is ONE command (`npm start`) — the Vite dev server stays a UI-development-only
// path (KIT-T132 follow-up). Returns null when no build exists: the API still runs, and
// the entry point prints how to produce the build. Mounted BEFORE the JSON 404 handler;
// /api and /health are excluded from the SPA fallback so unmatched API paths keep their
// typed-JSON 404 instead of an index.html 200.

import express, { Router } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const API_PREFIXES = ['/api', '/health'];

export function staticUiRoutes(uiDist) {
  if (!uiDist || !existsSync(join(uiDist, 'index.html'))) return null;
  const router = Router();
  router.use(express.static(uiDist));
  router.get('*', (req, res, next) => {
    if (API_PREFIXES.some((p) => req.path.startsWith(p))) return next();
    res.sendFile(join(uiDist, 'index.html'));
  });
  return router;
}
