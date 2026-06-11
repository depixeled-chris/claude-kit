// triage/write-item.mjs — the file mutators triage --apply uses. Markdown stays TRUTH: these write
// the SAME store files cap/triage always did. One responsibility each: mint an item from a store's
// _TEMPLATE.md, fold a note onto an existing item, set a supersede pointer, move a processed cap.

import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { slugify } from './cap-text.mjs';

const ID_STORES = ['tickets', 'decisions', 'notes', 'questions']; // stores whose files start with an id
const FM_END = '\n---'; // closing frontmatter fence (after the opening one)
const DATE_LEN = 10;    // YYYY-MM-DD
const STAMP_LEN = 16;   // YYYY-MM-DDTHH:MM
const FM_SKIP = 3;      // skip the opening '---\n' when searching for the closing fence

function setField(block, key, val) {
  const re = new RegExp(`^(${key}:)([^\\n]*)$`, 'm');
  return re.test(block) ? block.replace(re, `$1 ${val}`) : `${block}\n${key}: ${val}`;
}

// Backward-provenance fields a triaged bug may carry (KIT-T065). When an ACCEPTED inference (or a
// user-given link) is passed in, these land in the new item's frontmatter alongside a `provenance:`
// marker — `inferred` (a triage-time guess, auditable) vs `given` (user-supplied). Appending them to
// the frontmatter (vs only when the template names them) is deliberate: the template need not
// pre-declare provenance for a bug ticket to record its inferred culprit.
function appendProvenance(fm, prov) {
  if (!prov) return fm;
  let out = fm;
  if (prov.regressed_from) out = setField(out, 'regressed_from', prov.regressed_from);
  if (prov.causing_commit) out = setField(out, 'causing_commit', prov.causing_commit);
  if (prov.introduced_by) out = setField(out, 'introduced_by', prov.introduced_by);
  // Only mark provenance when at least one link was actually recorded — a bare marker on an empty
  // bug would be noise.
  if (prov.mark && (prov.regressed_from || prov.causing_commit || prov.introduced_by)) {
    out = setField(out, 'provenance', prov.mark);
  }
  return out;
}

// Fill the frontmatter scalars triage owns from a store's _TEMPLATE.md, inject the cap text as the
// body's Description/observation/question slot, and write `<id>-<slug>.md`. No template → a minimal
// frontmatter. `provenance` (optional) records an accepted backward-provenance link + its marker.
// Returns the store-relative path written (e.g. tickets/KIT-T050-foo.md).
export function writeFromTemplate({ aiDir, store, id, type, status, priority, title, links, text, provenance }) {
  const storeDir = join(aiDir, store);
  mkdirSync(storeDir, { recursive: true });
  const tplPath = join(storeDir, '_TEMPLATE.md');
  const now = new Date().toISOString();
  const linkList = `[${(links || []).join(', ')}]`;
  let content;
  if (existsSync(tplPath)) {
    const tpl = readFileSync(tplPath, 'utf8');
    const fmEnd = tpl.indexOf(FM_END, FM_SKIP);
    let fm = fmEnd >= 0 ? tpl.slice(0, fmEnd) : tpl;
    const rest = fmEnd >= 0 ? tpl.slice(fmEnd) : `${FM_END}\n`;
    fm = setField(fm, 'id', id);
    if (/^type:/m.test(fm) && type) fm = setField(fm, 'type', type);
    if (/^status:/m.test(fm) && status) fm = setField(fm, 'status', status);
    if (/^priority:/m.test(fm) && priority) fm = setField(fm, 'priority', priority);
    if (/^title:/m.test(fm)) fm = setField(fm, 'title', title);
    if (/^date:/m.test(fm)) fm = setField(fm, 'date', now.slice(0, DATE_LEN));
    if (/^created:/m.test(fm)) fm = setField(fm, 'created', now);
    if (/^updated:/m.test(fm)) fm = setField(fm, 'updated', now);
    if (/^links:/m.test(fm)) fm = setField(fm, 'links', linkList);
    fm = appendProvenance(fm, provenance);
    const body = rest.replace(/<what and why>|<the observation[^>]*>|<the question>/i, text);
    content = `${fm}${body}`;
  } else {
    let fm = ['---', `id: ${id}`, type ? `type: ${type}` : null, status ? `status: ${status}` : null,
      priority ? `priority: ${priority}` : null, `title: ${title}`, `links: ${linkList}`,
      `created: ${now}`, '---'].filter(Boolean).join('\n');
    fm = appendProvenance(fm.replace(/\n---$/, ''), provenance) + '\n---';
    content = `${fm}\n\n## Description\n${text}\n`;
  }
  const rel = `${store}/${id}-${slugify(title)}.md`;
  writeFileSync(join(aiDir, rel), content);
  return rel;
}

function findItemFile(aiDir, id) {
  for (const store of ID_STORES) {
    const dir = join(aiDir, store);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.startsWith(id)) return { store, file: f, path: join(dir, f) };
  }
  return null;
}

// Append a dated bullet under the target item's ## Notes (the history `(comment)` vocab).
export function foldNote(aiDir, targetId, text) {
  const hit = findItemFile(aiDir, targetId);
  if (!hit) return null;
  const cur = readFileSync(hit.path, 'utf8');
  const stamp = new Date().toISOString().slice(0, STAMP_LEN).replace('T', ' ');
  const line = `- [${stamp}] (comment) folded from triage: ${text}\n`;
  const next = /## Notes/.test(cur)
    ? cur.replace(/## Notes\n/, `## Notes\n${line}`)
    : `${cur.trimEnd()}\n\n## Notes\n${line}`;
  writeFileSync(hit.path, next);
  return `${hit.store}/${hit.file}`;
}

function setFrontmatterField(path, key, val) {
  let cur = readFileSync(path, 'utf8');
  const re = new RegExp(`^${key}:.*$`, 'm');
  cur = re.test(cur) ? cur.replace(re, `${key}: ${val}`) : cur.replace(/^---\n/, `---\n${key}: ${val}\n`);
  writeFileSync(path, cur);
}

// Set superseded_by on the OLD item (drops it from the active board + drain — KIT-T024).
export function supersede(aiDir, newId, oldId) {
  const hit = findItemFile(aiDir, oldId);
  if (!hit) return null;
  setFrontmatterField(hit.path, 'superseded_by', newId);
  return `${hit.store}/${hit.file}`;
}

// Record the supersedes pointer on the NEW item (newer → the older one it retires).
export function markSupersedes(aiDir, rel, oldId) {
  setFrontmatterField(join(aiDir, rel), 'supersedes', oldId);
}

// Move a processed cap under inbox/triaged/ — caps are NEVER deleted (audit trail). `capFile` is
// the items.file relpath (e.g. inbox/2026-...-foo.md).
export function moveCapToTriaged(aiDir, capFile) {
  const src = join(aiDir, capFile);
  const triagedDir = join(aiDir, 'inbox', 'triaged');
  mkdirSync(triagedDir, { recursive: true });
  const rel = `inbox/triaged/${basename(capFile)}`;
  if (existsSync(src)) renameSync(src, join(aiDir, rel));
  return rel;
}
