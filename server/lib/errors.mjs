// ApiError + the central error handler. Every deliberate 4xx flows through ApiError so a
// guard rejection (human_only, evidence floor, unknown id) becomes a typed status + message —
// never a bare 500. The handler is the single funnel: it shapes the {error:{code,message}}
// body and logs only genuine 5xx (a client 4xx is not a server fault).

import { STATUS } from './status.mjs';

export class ApiError extends Error {
  constructor(status, message, code = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export const notFound = (message) => new ApiError(STATUS.NOT_FOUND, message, 'not_found');

// Express identifies error middleware by arity — the 4th param (`next`) must be declared even
// though a terminal handler never calls it.
export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isApi = err instanceof ApiError;
  const status = isApi ? err.status : STATUS.SERVER_ERROR;
  const code = isApi ? err.code : 'internal_error';
  const message = isApi ? err.message : 'internal server error';
  if (status >= STATUS.SERVER_ERROR) {
    process.stderr.write(`[api] ${req.method} ${req.originalUrl} — ${(err && err.stack) || message}\n`);
  }
  res.status(status).json({ error: { code, message } });
}

export function notFoundHandler(req, res) {
  res.status(STATUS.NOT_FOUND).json({ error: { code: 'not_found', message: `no route for ${req.method} ${req.path}` } });
}
