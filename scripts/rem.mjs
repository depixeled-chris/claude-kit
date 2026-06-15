#!/usr/bin/env node
// rem.mjs — the user-defined recurring-reminders CLI (KIT-T090). One file per reminder under
// `.ai/reminders/` (atomic — KIT-D009); housekeeping surfaces the DUE ones at SessionStart with
// their `rem done` command inline (KIT-T074: a nag without a drain path trains you to ignore it).
//
//   rem add "Cut a weekly release" --every 7 --runbook "gh workflow run release.yml --ref master"
//   rem list                       # due now + upcoming (enabled); --all also shows disabled
//   rem done REM-001               # last_done = today, updated = now, (done) History line
//   rem snooze REM-001 3           # snooze_until = today+3, (snoozed 3d) History line (last_done UNCHANGED)
//   rem disable REM-001            # mute without deleting
//   rem enable REM-001
//   rem add "…" --project hod      # explicit target (mirrors cap.mjs: --project > cwd .ai/)
//
// State lives in FRONTMATTER, never mtime — reminders travel in git across machines (macOS +
// Windows) and checkout/clone destroys mtimes, so `last_done` is the only cross-machine-correct
// cadence anchor (KIT-T090 §1). Dep-free + fail-open, the cap.mjs house style.
//
// IDS: reminders use a FIXED, UNKEYED `REM-###` id (NOT `<KEY>-<TYPE><NUM>`) — minted by
// next-id's `reminders` special case (nextReminderId), so `REM-001` reads the same in every
// project and never collides with a project's R-prefixed requests.

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { readRegistry, projectAiDirs, writeItemFile } from '../hooks/lib.mjs';
import { nextReminderId } from './id-utils.mjs';

const DEFAULT_EVERY = 7; // weekly — the driving use case (GH Actions cache warmth) and a sane default
const SLUG_MAX = 48;
const DATE_END = 10; // YYYY-MM-DD slice of an ISO string

// --- the .ai dir: explicit --project (registry match) wins over the nearest .ai/ above cwd -----
function findAiDir(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.ai', 'config.yml'))) return join(dir, '.ai');
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// A project's id key (ids.key) — the short alias a --project flag is likely to name. Tolerant
// line-scan, no yaml dep (mirrors cap.mjs.idKey); '' when absent.
function idKey(aiDir) {
  try {
    const m = readFileSync(join(aiDir, 'config.yml'), 'utf8').match(/^ids:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+key:[ \t]*["']?([A-Za-z0-9_-]+)/m);
    return m ? m[1] : '';
  } catch {
    return '';
  }
}

// The routing table: every registered project as { name, aiDir, aliases } (lowercased name + key).
// Best-effort, built on the fail-open projectAiDirs — a broken registry yields cwd-only routing.
function projectTable() {
  return projectAiDirs().map(({ name, aiDir }) => {
    const key = idKey(aiDir);
    const aliases = new Set([name.toLowerCase()]);
    if (key) aliases.add(key.toLowerCase());
    return { name, aiDir, aliases };
  });
}

function matchProject(table, name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  return table.find((p) => p.aliases.has(n)) || null;
}

// Pull --project / -p out of argv (also --project=x). Returns { project, rest }.
function takeProjectFlag(argv) {
  const out = [];
  let project = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.match(/^--project=(.+)$/);
    if (eq) { project = eq[1]; continue; }
    if (a === '--project' || a === '-p') { project = argv[i + 1] ?? null; i++; continue; }
    out.push(a);
  }
  return { project, rest: out };
}

// Resolve the destination .ai dir + a display name. --project naming nothing real is a hard error
// (an explicit target silently falling through to cwd would recreate the misroute it prevents,
// KIT-T067). No flag → nearest .ai/ above cwd.
function resolveTarget(flagProject) {
  const table = projectTable();
  if (flagProject) {
    const hit = matchProject(table, flagProject);
    if (!hit) {
      const known = table.map((p) => p.name).join(', ') || '(registry empty)';
      fail(`--project "${flagProject}" matches no registered project. Known: ${known}`);
    }
    return { aiDir: hit.aiDir, projectName: hit.name };
  }
  const aiDir = findAiDir(process.cwd());
  if (!aiDir) fail(`no .ai/ found above ${process.cwd()} — pass --project <name> or run init-project.mjs first.`);
  const cwdEntry = table.find((p) => existsSync(p.aiDir) && resolve(p.aiDir) === resolve(aiDir));
  const projectName = cwdEntry ? cwdEntry.name
    : (readRegistry().dataRoot && aiDir.includes('projects') ? basename(dirname(aiDir)) : basename(dirname(resolve(aiDir))));
  return { aiDir, projectName };
}

// --- frontmatter edit primitives (self-contained — rem.mjs stays dep-free like cap.mjs) --------

// `2026-06-15 13:42` — the History timestamp shape (date + HH:MM), matching t.mjs/db-parse.
function stamp() {
  const iso = new Date().toISOString();
  return `${iso.slice(0, DATE_END)} ${iso.slice(11, 16)}`;
}
const today = () => new Date().toISOString().slice(0, DATE_END);
const nowIso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');

function splitDoc(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { fm: m[1], body: m[2] };
}
function field(fm, key) {
  const m = fm.match(new RegExp(`^${key}:[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
}

// Set (or insert) a single frontmatter field, preserving everything else. The value is written
// raw (callers pass already-safe scalars: dates, booleans, plain titles).
function setField(fm, key, value) {
  const re = new RegExp(`^(${key}:)[ \\t]*.*$`, 'm');
  if (re.test(fm)) return fm.replace(re, `$1 ${value}`);
  return `${fm}\n${key}: ${value}`; // absent → append (keeps a hand-trimmed file working)
}

// Append a line under `## <heading>`, creating the section at EOF when absent. The section ends
// at the next `## ` or EOF, so a History line lands inside History even with sections after it.
function appendUnderSection(body, heading, line) {
  const h = `## ${heading}`;
  const idx = body.indexOf(`${h}\n`) === -1 ? body.indexOf(h) : body.indexOf(`${h}\n`);
  if (idx === -1) return `${body.replace(/\s+$/, '')}\n\n${h}\n${line}\n`;
  const after = body.indexOf('\n## ', idx + h.length);
  const end = after === -1 ? body.length : after;
  const section = body.slice(idx, end).replace(/\s+$/, '');
  return body.slice(0, idx) + section + `\n${line}\n` + (after === -1 ? '' : body.slice(end));
}

// --- reminder file lookup ----------------------------------------------------------------------
function remindersDir(aiDir) {
  return join(aiDir, 'reminders');
}

// Resolve an id (REM-001, case-insensitive) to its file under .ai/reminders/. Throws if unknown —
// no verb invents an id. Prefers the frontmatter id, falls back to the filename's leading token.
function findReminder(aiDir, id) {
  const dir = remindersDir(aiDir);
  const want = String(id).trim().toUpperCase();
  let entries = [];
  try { entries = readdirSync(dir); } catch { /* no dir */ }
  for (const f of entries) {
    if (!f.endsWith('.md') || f.startsWith('_') || f === 'README.md') continue;
    const path = join(dir, f);
    const text = readFileSync(path, 'utf8');
    const doc = splitDoc(text);
    const fid = (doc && field(doc.fm, 'id')) || (f.match(/^REM-\d+/) || [])[0] || '';
    if (fid.toUpperCase() === want) return { id: fid, path, file: f, text, doc };
  }
  fail(`unknown reminder '${id}' — no file under .ai/reminders/ carries it (ids are minted by 'rem add', never guessed).`);
}

// Rewrite a reminder: optional frontmatter field changes + an optional History line. Always bumps
// `updated`. One write, so a verb is atomic from the reader's view. Routes through writeItemFile
// so mutations hydrate the cache at the write site (KIT-T096). Reminders are in NON_STORE_DIRS
// so the hydrate is a no-op by design — future-proof when id-scheme work keys them (follow-up).
async function rewriteReminder(rem, { fields = {}, history = null } = {}) {
  let { fm, body } = rem.doc;
  for (const [k, v] of Object.entries(fields)) fm = setField(fm, k, v);
  fm = setField(fm, 'updated', nowIso());
  if (history) body = appendUnderSection(body, 'History', `- [${stamp()}] ${history}`);
  await writeItemFile(rem.path, `---\n${fm}\n---\n${body}`);
}

// --- arg helpers -------------------------------------------------------------------------------
function takeValueFlag(argv, names) {
  const out = [];
  let value = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.match(/^(--[\w-]+)=(.*)$/);
    if (eq && names.includes(eq[1])) { value = eq[2]; continue; }
    if (names.includes(a)) { value = argv[i + 1] ?? null; i++; continue; }
    out.push(a);
  }
  return { value, rest: out };
}
function takeBoolFlag(argv, names) {
  const out = [];
  let present = false;
  for (const a of argv) {
    if (names.includes(a)) { present = true; continue; }
    out.push(a);
  }
  return { present, rest: out };
}

function fail(msg) {
  console.error('rem: ' + msg);
  process.exit(1);
}

// --- verbs -------------------------------------------------------------------------------------

async function cmdAdd(args, target) {
  const ev = takeValueFlag(args, ['--every', '-e']);
  const rb = takeValueFlag(ev.rest, ['--runbook', '-r']);
  const title = rb.rest.join(' ').trim();
  if (!title) fail('add: a non-empty "<title>" is required (rem add "<title>" --every <days>).');
  let every = DEFAULT_EVERY;
  if (ev.value != null) {
    const n = parseInt(ev.value, 10);
    if (!Number.isInteger(n) || n <= 0) fail(`add: --every must be a positive integer (got "${ev.value}").`);
    every = n;
  }
  const dir = remindersDir(target.aiDir);
  mkdirSync(dir, { recursive: true });
  const id = nextReminderId(dirname(target.aiDir)); // nextReminderId takes the repo root (it appends .ai/reminders)
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, SLUG_MAX) || 'reminder';
  const path = join(dir, `${id}-${slug}.md`);
  if (existsSync(path)) fail(`add: ${path} already exists.`);
  const created = nowIso();
  // last_done SEEDED to the created date (KIT-T090 §5): a new reminder must not instantly nag —
  // the first nag fires after one full `every_days` cadence.
  const doc = `---
id: ${id}
title: ${title}
every_days: ${every}
last_done: ${today()}
snooze_until:
enabled: true
links: []
created: ${created}
updated: ${created}
---

## Runbook
${rb.value ? rb.value + '\n' : '<what doing this reminder means — commands, links, context>\n'}
## History
- [${stamp()}] (created)
`;
  await writeItemFile(path, doc);
  console.log(`reminder ${id} -> ${target.projectName}/reminders/${basename(path)} (every ${every}d; first nag in ${every}d)`);
}

function readAll(aiDir) {
  const dir = remindersDir(aiDir);
  let entries = [];
  try { entries = readdirSync(dir); } catch { return []; }
  const out = [];
  const MS_PER_DAY = 86400000;
  const todayDay = Math.floor(Date.now() / MS_PER_DAY);
  for (const f of entries) {
    if (!f.endsWith('.md') || f.startsWith('_') || f === 'README.md') continue;
    let doc;
    try { doc = splitDoc(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    if (!doc) continue;
    const id = field(doc.fm, 'id') || (f.match(/^REM-\d+/) || [])[0];
    if (!id) continue;
    const enabled = !/^(false|no|0)$/i.test(field(doc.fm, 'enabled'));
    const lastStr = field(doc.fm, 'last_done');
    const lastMs = Date.parse(lastStr.slice(0, DATE_END));
    const lastDay = Number.isFinite(lastMs) ? Math.floor(lastMs / MS_PER_DAY) : null;
    const everyN = parseInt(field(doc.fm, 'every_days'), 10);
    const every = Number.isInteger(everyN) && everyN > 0 ? everyN : DEFAULT_EVERY;
    const dueIn = lastDay === null ? null : (lastDay + every) - todayDay; // <=0 = due now
    const snoozeStr = field(doc.fm, 'snooze_until');
    out.push({ id, title: field(doc.fm, 'title') || id, every, enabled, dueIn, snoozeStr, file: f });
  }
  return out;
}

function cmdList(args, target) {
  const all = takeBoolFlag(args, ['--all', '-a']).present;
  const items = readAll(target.aiDir).filter((r) => all || r.enabled);
  if (!items.length) {
    console.log(all ? 'no reminders.' : 'no enabled reminders (try --all).');
    return;
  }
  // Most-overdue first, then soonest-due; disabled sink to the bottom.
  items.sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1)
    || (a.dueIn ?? 1e9) - (b.dueIn ?? 1e9));
  for (const r of items) {
    const state = !r.enabled ? 'disabled'
      : r.dueIn === null ? 'no last_done'
      : r.snoozeStr && Date.parse(r.snoozeStr.slice(0, DATE_END)) > Date.now() && (r.dueIn <= 0) ? `snoozed→${r.snoozeStr}`
      : r.dueIn <= 0 ? (r.dueIn === 0 ? 'DUE today' : `DUE ${-r.dueIn}d overdue`)
      : `in ${r.dueIn}d`;
    console.log(`  ${r.id}  [${state}]  every ${r.every}d  —  ${r.title}`);
  }
}

async function cmdDone(args, target) {
  const id = args[0];
  if (!id) fail('done: a reminder id is required (rem done REM-001).');
  const rem = findReminder(target.aiDir, id);
  // done advances the cadence anchor; snooze_until is cleared (a fresh cycle starts).
  await rewriteReminder(rem, { fields: { last_done: today(), snooze_until: '' }, history: '(done)' });
  console.log(`${rem.id} done — last_done = ${today()}.`);
}

async function cmdSnooze(args, target) {
  const id = args[0];
  const days = parseInt(args[1], 10);
  if (!id) fail('snooze: a reminder id is required (rem snooze REM-001 3).');
  if (!Number.isInteger(days) || days <= 0) fail(`snooze: <days> must be a positive integer (got "${args[1]}").`);
  const rem = findReminder(target.aiDir, id);
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, DATE_END);
  // Snooze defers WITHOUT moving last_done (KIT-T090 §5): done and deferred are different events,
  // and History records which one happened.
  await rewriteReminder(rem, { fields: { snooze_until: until }, history: `(snoozed ${days}d)` });
  console.log(`${rem.id} snoozed ${days}d — snooze_until = ${until} (last_done unchanged).`);
}

async function cmdToggle(args, target, enable) {
  const id = args[0];
  if (!id) fail(`${enable ? 'enable' : 'disable'}: a reminder id is required.`);
  const rem = findReminder(target.aiDir, id);
  await rewriteReminder(rem, { fields: { enabled: enable ? 'true' : 'false' }, history: enable ? '(enabled)' : '(disabled)' });
  console.log(`${rem.id} ${enable ? 'enabled' : 'disabled'}.`);
}

// --- dispatch ----------------------------------------------------------------------------------
const USAGE = 'usage: rem <add|list|done|snooze|disable|enable> ... [--project <name>]';

const raw = process.argv.slice(2);
if (!raw.length) fail(USAGE);

const { project: flagProject, rest } = takeProjectFlag(raw);
const verb = rest[0];
const args = rest.slice(1);
const target = resolveTarget(flagProject);

switch (verb) {
  case 'add': await cmdAdd(args, target); break;
  case 'list': case 'ls': cmdList(args, target); break;
  case 'done': await cmdDone(args, target); break;
  case 'snooze': await cmdSnooze(args, target); break;
  case 'disable': await cmdToggle(args, target, false); break;
  case 'enable': await cmdToggle(args, target, true); break;
  default: fail(`unknown verb '${verb ?? ''}'. ${USAGE}`);
}
