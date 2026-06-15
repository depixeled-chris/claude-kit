#!/usr/bin/env node
// Tests for the reminders store (KIT-T090): the scanReminders due-logic (lib.mjs), the REM-###
// id minter (id-utils.mjs), and the rem.mjs CLI verbs. The math/fail-open is exercised by calling
// scanReminders directly (pure fn of a repo root); the CLI mutations are driven through the REAL
// script in a throwaway temp repo (cap.test.mjs style), so the whole arg→file path is covered.
// exit 0 = all pass.

import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { scanReminders } from '../hooks/lib.mjs';
import { nextReminderId } from './id-utils.mjs';

const REM = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');
const MS_PER_DAY = 86400000;

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else      { fail++; console.log('  FAIL  ' + name); }
}

// A date-only ISO string N days from today (negative = past), e.g. day(-7) = a week ago.
function day(offset) {
  return new Date(Date.now() + offset * MS_PER_DAY).toISOString().slice(0, 10);
}

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-rem-'));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'reminders'), { recursive: true });
  writeFileSync(
    join(root, '.ai', 'config.yml'),
    'classifications:\n  reminder: { routes_to: reminders, blocking: never }\nids:\n  key: "TST"\n  pad: 3\n',
  );
  return root;
}

// Write a reminder file. `fm` is the full frontmatter body (so a test can omit/break fields).
function writeReminder(root, name, fm, body = '\n## Runbook\n\n## History\n- [2026-01-01 00:00] (created)\n') {
  writeFileSync(join(root, '.ai', 'reminders', name), `---\n${fm}\n---\n${body}`);
}

function rem(repo, args) {
  return execFileSync(process.execPath, [REM, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-registry-for-rem-test.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}
function read001(repo) {
  const dir = join(repo, '.ai', 'reminders');
  const f = readdirSync(dir).find((x) => x.startsWith('REM-001'));
  return readFileSync(join(dir, f), 'utf8');
}

// --------------------------------------------------------------------------
// 1. scanReminders due/not-due/snoozed/disabled math
// --------------------------------------------------------------------------
console.log('\nscanReminders: due / not-due / snoozed / disabled');
{
  const repo = makeRepo();
  writeReminder(repo, 'REM-001-due.md',     `id: REM-001\ntitle: overdue\nevery_days: 7\nlast_done: ${day(-10)}\nsnooze_until:\nenabled: true`);
  writeReminder(repo, 'REM-002-fresh.md',   `id: REM-002\ntitle: fresh\nevery_days: 7\nlast_done: ${day(0)}\nenabled: true`);
  writeReminder(repo, 'REM-003-snoozed.md', `id: REM-003\ntitle: snoozed\nevery_days: 7\nlast_done: ${day(-10)}\nsnooze_until: ${day(2)}\nenabled: true`);
  writeReminder(repo, 'REM-004-off.md',     `id: REM-004\ntitle: muted\nevery_days: 7\nlast_done: ${day(-30)}\nenabled: false`);
  writeReminder(repo, 'REM-005-snoozepast.md', `id: REM-005\ntitle: snoozepast\nevery_days: 7\nlast_done: ${day(-10)}\nsnooze_until: ${day(-1)}\nenabled: true`);

  const res = scanReminders(repo);
  const dueIds = res.due.map((d) => d.id);
  ok('overdue reminder is due (REM-001)', dueIds.includes('REM-001'));
  ok('fresh reminder is NOT due (REM-002)', !dueIds.includes('REM-002'));
  ok('future-snoozed reminder is NOT due (REM-003)', !dueIds.includes('REM-003'));
  ok('disabled reminder is NOT due (REM-004)', !dueIds.includes('REM-004'));
  ok('past-snoozed reminder is due again (REM-005)', dueIds.includes('REM-005'));
  ok('overdueDays computed (REM-001 = 3)', res.due.find((d) => d.id === 'REM-001').overdueDays === 3);
  ok('due sorted most-overdue first', res.due.length >= 2 && res.due[0].overdueDays >= res.due[res.due.length - 1].overdueDays);
  ok('total counts all valid reminders', res.total === 5);
}

// --------------------------------------------------------------------------
// 2. Date-only boundary: due EXACTLY at last_done + every_days (overdue 0)
// --------------------------------------------------------------------------
console.log('\nscanReminders: due exactly at last_done + every_days (boundary)');
{
  const repo = makeRepo();
  writeReminder(repo, 'REM-001-boundary.md', `id: REM-001\ntitle: boundary\nevery_days: 7\nlast_done: ${day(-7)}\nenabled: true`);
  writeReminder(repo, 'REM-002-daybefore.md', `id: REM-002\ntitle: daybefore\nevery_days: 7\nlast_done: ${day(-6)}\nenabled: true`);
  const res = scanReminders(repo);
  const due = res.due.find((d) => d.id === 'REM-001');
  ok('due AT the boundary (last_done + every_days == today)', !!due);
  ok('boundary overdue = 0 (due today, not yet overdue)', due && due.overdueDays === 0);
  ok('one day BEFORE the boundary is NOT due', !res.due.some((d) => d.id === 'REM-002'));
}

// --------------------------------------------------------------------------
// 3. Malformed reminder file → scanReminders SKIPS it and does NOT throw
// --------------------------------------------------------------------------
console.log('\nscanReminders: malformed files are skipped, never thrown');
{
  const repo = makeRepo();
  // a genuinely frontmatter-less file (the AC's case), an empty file, and binary junk
  writeFileSync(join(repo, '.ai', 'reminders', 'REM-001-broken.md'), 'no frontmatter here, just :: weird : prose');
  writeFileSync(join(repo, '.ai', 'reminders', 'REM-002-empty.md'), '');
  writeFileSync(join(repo, '.ai', 'reminders', 'REM-003-binary.md'), Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02]));
  // plus one VALID due reminder, to prove the good one still surfaces past the bad ones
  writeReminder(repo, 'REM-004-good.md', `id: REM-004\ntitle: good\nevery_days: 7\nlast_done: ${day(-10)}\nenabled: true`);

  let threw = false;
  let res;
  try { res = scanReminders(repo); } catch { threw = true; }
  ok('scanReminders did NOT throw on malformed files', !threw);
  ok('the valid due reminder still surfaces', !!res && res.due.some((d) => d.id === 'REM-004'));
  ok('frontmatter-less files are not counted in total', !!res && res.total === 1);
}

// --------------------------------------------------------------------------
// 4. nextReminderId mints REM-001 then REM-002 (fixed, unkeyed)
// --------------------------------------------------------------------------
console.log('\nnextReminderId: REM-001 → REM-002 (fixed, unkeyed)');
{
  const repo = makeRepo();
  ok('empty store mints REM-001', nextReminderId(repo) === 'REM-001');
  writeReminder(repo, 'REM-001-a.md', 'id: REM-001\ntitle: a\nevery_days: 7\nlast_done: 2026-01-01');
  ok('with REM-001 present mints REM-002', nextReminderId(repo) === 'REM-002');
  writeReminder(repo, 'REM-007-b.md', 'id: REM-007\ntitle: b\nevery_days: 7\nlast_done: 2026-01-01');
  ok('uses max trailing number (gap not reused): REM-008', nextReminderId(repo) === 'REM-008');
  // The id is unkeyed — does NOT carry the project key (TST) — so it cannot collide with TST-R*.
  ok('id is unkeyed (no project key prefix)', /^REM-\d+$/.test(nextReminderId(repo)));
}

// --------------------------------------------------------------------------
// 5. rem add seeds last_done = created → a new reminder is NOT instantly due
// --------------------------------------------------------------------------
console.log('\nrem add: seeds last_done so a new reminder is not instantly due');
{
  const repo = makeRepo();
  rem(repo, ['add', 'Cut a weekly release', '--every', '7', '--runbook', 'gh workflow run release.yml']);
  const content = read001(repo);
  ok('REM-001 file written', /id: REM-001/.test(content));
  ok('last_done seeded to today', content.includes(`last_done: ${day(0)}`));
  ok('runbook injected', content.includes('gh workflow run release.yml'));
  ok('(created) History line present', /\(created\)/.test(content));
  ok('a freshly-added reminder is NOT due', scanReminders(repo).due.length === 0);
}

// --------------------------------------------------------------------------
// 6. rem done advances last_done + appends a (done) History line
// --------------------------------------------------------------------------
console.log('\nrem done: advances last_done + appends History');
{
  const repo = makeRepo();
  rem(repo, ['add', 'weekly thing', '--every', '7']);
  // backdate so it is overdue, making the advance observable
  const dir = join(repo, '.ai', 'reminders');
  const f = join(dir, readdirSync(dir).find((x) => x.startsWith('REM-001')));
  writeFileSync(f, readFileSync(f, 'utf8').replace(/last_done: .*/, 'last_done: 2000-01-01'));
  ok('overdue before done', scanReminders(repo).due.length === 1);

  rem(repo, ['done', 'rem-001']); // case-insensitive id
  const content = read001(repo);
  ok('last_done advanced to today', content.includes(`last_done: ${day(0)}`) && !content.includes('2000-01-01'));
  ok('(done) History line appended', /\(done\)/.test(content));
  ok('History keeps the prior (created) line (append-only)', /\(created\)/.test(content));
  ok('not due after done', scanReminders(repo).due.length === 0);
}

// --------------------------------------------------------------------------
// 7. rem snooze sets snooze_until WITHOUT moving last_done
// --------------------------------------------------------------------------
console.log('\nrem snooze: sets snooze_until, leaves last_done in place');
{
  const repo = makeRepo();
  rem(repo, ['add', 'snoozable', '--every', '7']);
  const before = (read001(repo).match(/last_done: (.*)/) || [])[1];
  rem(repo, ['snooze', 'REM-001', '5']);
  const content = read001(repo);
  const after = (content.match(/last_done: (.*)/) || [])[1];
  ok('last_done unchanged by snooze', before === after);
  ok('snooze_until set to today + 5', content.includes(`snooze_until: ${day(5)}`));
  ok('(snoozed 5d) History line appended', /\(snoozed 5d\)/.test(content));
}

// --------------------------------------------------------------------------
// 8. rem disable / enable toggle `enabled` + record History
// --------------------------------------------------------------------------
console.log('\nrem disable / enable');
{
  const repo = makeRepo();
  rem(repo, ['add', 'togglable', '--every', '7']);
  rem(repo, ['disable', 'REM-001']);
  ok('disabled sets enabled: false', /enabled: false/.test(read001(repo)));
  ok('(disabled) History line', /\(disabled\)/.test(read001(repo)));
  rem(repo, ['enable', 'REM-001']);
  ok('enabled sets enabled: true', /enabled: true/.test(read001(repo)));
  ok('(enabled) History line', /\(enabled\)/.test(read001(repo)));
}

// --------------------------------------------------------------------------
// 9. rem done on an unknown id is a hard error (never invents an id)
// --------------------------------------------------------------------------
console.log('\nrem done <unknown>: hard error');
{
  const repo = makeRepo();
  let threw = false;
  try { rem(repo, ['done', 'REM-999']); } catch { threw = true; }
  ok('unknown id exits non-zero', threw);
}

// --------------------------------------------------------------------------
// Teardown
// --------------------------------------------------------------------------
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
