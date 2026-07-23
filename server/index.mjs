#!/usr/bin/env node
// Entry point: resolve config, build the app, bind 127.0.0.1 ONLY. Start with:
//   node server/index.mjs            (defaults to 127.0.0.1:4319)
//   KIT_SERVER_PORT=4400 node server/index.mjs
// The React/Vite client (http://localhost:5173) is the CORS-allowed origin.

import { resolveConfig } from './config.mjs';
import { buildApp } from './app.mjs';

const config = resolveConfig();
const app = buildApp(config);

app.listen(config.port, config.host, () => {
  process.stdout.write(
    `claude-kit API listening on http://${config.host}:${config.port} (CORS: ${config.corsOrigin})\n`,
  );
});
