// HTTP status codes as named constants — the ONE place a number stands for a status, so
// route/service code reads STATUS.NOT_FOUND, never a bare 404 (also keeps the magic-number
// gate satisfied: every code lives on a `name: value` declaration line here).

export const STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  SERVER_ERROR: 500,
};
