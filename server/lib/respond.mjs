// The {data, meta} response envelope + asyncHandler. Every successful response is
// `{ data, meta }` (camelCase throughout); asyncHandler forwards a rejected promise to the
// central error handler so a route body never needs its own try/catch.

import { STATUS } from './status.mjs';

export const envelope = (data, meta = {}) => ({ data, meta });

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function send(res, data, meta = {}, status = STATUS.OK) {
  res.status(status).json(envelope(data, meta));
}
