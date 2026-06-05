// triage/cap-text.mjs — parse a cap's body into its (type) tag, human text, and an FTS dedup
// needle. The (type) shape matches cap.mjs writes / db-parse.leadingType reads, so the three agree
// on what counts as an explicit type.

const TYPE_RE = /^\(([a-z][\w-]*)\)/i;
const STRIP_TYPE = /^\([a-z][\w-]*\)\s*/i;
const ALNUM_TERM = /[a-z][a-z\d]*/g;
const MIN_TERM_LEN = 2; // ignore terms this short (a, of, id) when building the OR-needle
const SLUG_MAX = 48;
const NON_SLUG = /[^a-z\d]+/g;
const TRIM_DASH = /^-|-$/g;

export function leadingType(body) {
  const m = String(body || '').trimStart().match(TYPE_RE);
  return m ? m[1] : '';
}

export function capText(body) {
  return String(body || '').trim().replace(STRIP_TYPE, '').trim();
}

// A proposal -> an FTS OR-query so a candidate matches on ANY shared term (a duplicate rarely
// shares every word). Empty in -> a never-matching query, so a blank cap surfaces no candidates.
export function ftsOrQuery(text) {
  const terms = (String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN);
  return terms.length ? terms.join(' OR ') : '""';
}

export function slugify(text) {
  return String(text).toLowerCase().replace(NON_SLUG, '-').replace(TRIM_DASH, '').slice(0, SLUG_MAX) || 'item';
}

export function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
