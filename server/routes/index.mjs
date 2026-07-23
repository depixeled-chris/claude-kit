// Mount every route group onto the app, then the 404 + central error handler LAST (so an
// unmatched path and any thrown ApiError both get the typed-JSON treatment).

import { healthRoutes } from './health.mjs';
import { projectRoutes } from './projects.mjs';
import { waitingRoutes } from './waiting.mjs';
import { staticUiRoutes } from '../lib/static-ui.mjs';
import { notFoundHandler, errorHandler } from '../lib/errors.mjs';

export function mountRoutes(app, config) {
  app.use('/health', healthRoutes(config));
  app.use('/api/projects', projectRoutes(config));
  app.use('/api/waiting', waitingRoutes());
  const ui = staticUiRoutes(config.uiDist);
  if (ui) app.use(ui);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
