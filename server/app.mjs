// buildApp(config) → a wired Express app WITHOUT listening (so tests can mount it on an
// ephemeral port and the entry point owns the 127.0.0.1 bind). CORS is scoped to the
// configured Vite origin; JSON bodies are parsed for the write endpoints.

import express from 'express';
import cors from 'cors';
import { mountRoutes } from './routes/index.mjs';

export function buildApp(config) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json());
  mountRoutes(app, config);
  return app;
}
