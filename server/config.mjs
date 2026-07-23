// Server config. Localhost-ONLY bind and a CORS allow-list scoped to the Vite dev client are
// baked in (KIT-D044 phase 1: no auth, dev machine only). `hydrateRoot: undefined` means the
// shared cache is cross-scope (covers every registered project); the DB path follows the kit
// install (CLAUDE_PLUGIN_ROOT-aware via defaultDbPath). Tests pass overrides to swap in a
// fixture discovery + a temp DB — never the real registry or cache.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { defaultDbPath } from '../scripts/hydrate-db.mjs';
import { createRegistryDiscovery } from './services/discovery.mjs';

const HOST = '127.0.0.1'; // localhost only — never binds a public interface (KIT-D044)
const CORS_ORIGIN = 'http://localhost:5173'; // the Vite dev origin
const DEFAULT_PORT = 4319;
const UI_DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'ui', 'dist');

export function resolveConfig(overrides = {}) {
  const port = Number(process.env.KIT_SERVER_PORT || process.env.PORT || DEFAULT_PORT);
  return {
    host: HOST,
    port,
    corsOrigin: CORS_ORIGIN,
    dbPath: defaultDbPath(),
    hydrateRoot: undefined,
    discovery: createRegistryDiscovery(),
    uiDist: UI_DIST,
    ...overrides,
  };
}
