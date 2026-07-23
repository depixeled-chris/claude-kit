// Chip-value classifier (KIT-T148). A ticket-detail link/frontmatter value is one of three kinds,
// and ONLY a real item id may navigate in-app — the bug this fixes was a commit sha (from
// fixed_commit / causing_commit / a sha inside links) rendering as a ticket-id link, so a click
// dead-ended on a "no ticket" route.
//   - 'item'   : a work-item id  <KEY>-<T|D|Q|N|R|E><num>  (e.g. KIT-T148, GG-D044, FOO-BAR-T1)
//   - 'commit' : a git sha, hex 7–40 chars                 (e.g. fd2f925)
//   - 'text'   : anything else, rendered inert
// Order matters, but the kinds are disjoint: an id always carries a '-' and a non-hex type letter,
// so it can never look like a bare hex run, and a sha never carries a '-'. Item is tested first.
//
// Authored as .mjs (with a sibling chips.d.ts) so the SAME implementation is both imported by the
// React UI and unit-tested directly by the node test runner — no duplicated regex (DRY).

export const ITEM_ID_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-[tdnqre]\d+$/i;
export const COMMIT_SHA_RE = /^[0-9a-f]{7,40}$/i;

export function classifyChip(value) {
  const v = String(value == null ? '' : value).trim();
  if (ITEM_ID_RE.test(v)) return 'item';
  if (COMMIT_SHA_RE.test(v)) return 'commit';
  return 'text';
}
