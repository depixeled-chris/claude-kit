// frontmatter.mjs — the ONE comment-aware, CRLF-tolerant frontmatter parser (KIT-T107).
//
// Three scripts grew their own copies of this parse and two of the copies carried live
// bugs: reconcile-supersede's field() read the _TEMPLATE's trailing comment on
// `superseded_by:` as a real pointer (mass phantom-supersede, 2026-07-14), and every
// LF-only `^---\n` block regex silently returned NO frontmatter for a file whose first
// line ends CRLF (KIT-T124: junk board rows, duplicate-id aborts). Consumers:
// db-parse.mjs, index-tickets.mjs, reconcile-supersede.mjs — import from here, never
// re-derive (KIT-T110 finishes the job for t.mjs/sync-tasks/id-utils).

// The frontmatter block's inner text, or '' when the file has none. Tolerates \r\n on
// the delimiter lines — Windows editors and autocrlf checkouts produce them routinely.
export function frontmatterBlock(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : '';
}

// Split form for writers that reassemble the file (reconcile-supersede). Returns
// { open, fm, close, rest } or null when the file has no frontmatter.
export function splitFrontmatter(text) {
  const m = text.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!m) return null;
  return { open: m[1], fm: m[2], close: m[3], rest: text.slice(m[0].length) };
}

// Drop a trailing YAML line-comment (` # …`). A `#` inside `[...]` or a quote is kept —
// it may be a real value char; only a top-level `#` that starts the value or follows
// whitespace is a comment (the YAML convention). Origin: db-parse (KIT-T049).
export function stripComment(raw) {
  let depth = 0;
  let quote = '';
  for (let k = 0; k < raw.length; k++) {
    const c = raw[k];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth++;
    else if (c === ']') depth = Math.max(0, depth - 1);
    else if (c === '#' && depth === 0 && (k === 0 || /\s/.test(raw[k - 1]))) return raw.slice(0, k);
  }
  return raw;
}

// A frontmatter scalar: comment-stripped, trimmed, unquoted. A template line whose value
// is only a comment (`superseded_by:   # ticket id that retired THIS one`) reads as ''.
export function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? stripComment(m[1]).trim().replace(/^["']|["']$/g, '') : '';
}

// A YAML-ish inline list (`links: [A, B]`) or a single bare scalar -> string[].
export function listField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  if (!m) return [];
  const raw = stripComment(m[1]).trim();
  if (!raw) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}
