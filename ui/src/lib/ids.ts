// A work-item id is `<KEY>-<TYPE><num>` (KIT-T132, CRX-Q7). The project KEY is the URL scope
// segment (/p/:key) and the cache `scope` — it is exactly the id prefix before the final
// `-<letter(s)><digits>` group. The waiting board groups by project NAME, which is not the key,
// so a review item's link derives its key from the item id instead (the route resolves it
// case-insensitively). Handles hyphenated keys (FOO-BAR-T1 → FOO-BAR).

const ID_SUFFIX = /^(.*)-[A-Za-z]+\d+$/;

export function keyFromId(id: string): string {
  const m = String(id || '').match(ID_SUFFIX);
  return m ? m[1] : id;
}
