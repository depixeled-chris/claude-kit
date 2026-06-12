// Tests for hooks/big-ask-nudge.mjs
// Pattern: spawn the hook with a JSON payload on stdin; assert exit code + stderr.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const HOOK = new URL('../hooks/big-ask-nudge.mjs', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

let failures = 0;

function expect(name, actual, wanted) {
  if (actual === wanted) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`);
    failures++;
  }
}

function expectContains(name, haystack, needle) {
  if (typeof haystack === 'string' && haystack.includes(needle)) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}: ${JSON.stringify(haystack)} does not contain ${JSON.stringify(needle)}`);
    failures++;
  }
}

function expectNotContains(name, haystack, needle) {
  if (typeof haystack === 'string' && !haystack.includes(needle)) {
    console.log(`PASS  ${name}`);
  } else {
    console.error(`FAIL  ${name}: ${JSON.stringify(haystack)} unexpectedly contains ${JSON.stringify(needle)}`);
    failures++;
  }
}

function makeRepo({ adopt = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'big-ask-test-'));
  spawnSync('git', ['init', '-q'], { cwd: dir });
  spawnSync('git', ['commit', '--allow-empty', '-m', 'init'], { cwd: dir });
  if (adopt) mkdirSync(join(dir, '.ai'), { recursive: true });
  return dir;
}

function run(dir, promptText) {
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: dir,
    input: JSON.stringify({ prompt: promptText }),
    encoding: 'utf8',
  });
  return { code: result.status, err: result.stderr || '' };
}

// ── Adopted repo tests ─────────────────────────────────────────────────────────

const repoDir = makeRepo({ adopt: true });

// 1. Clear big ask: long + architecture signal → nudge fires
{
  const bigAsk = 'Redesign the entire authentication architecture across the whole system and migrate every service to use the new identity provider. This will touch every module and require end-to-end changes throughout the codebase.';
  const { code, err } = run(repoDir, bigAsk);
  expect('big ask: exit 0', code, 0);
  expectContains('big ask: nudge in stderr', err, 'big ask detected');
}

// 2. Routine ask: short → no nudge
{
  const { code, err } = run(repoDir, 'fix the typo in the header');
  expect('routine short ask: exit 0', code, 0);
  expectNotContains('routine short ask: no nudge', err, 'big ask detected');
}

// 3. Long but no scope signal → no nudge (AC4: length alone is not enough)
{
  const longButRoutine = 'Please update the documentation for the login screen to explain what the email field and password field do, and add a note about resetting the password. Also make the text a bit clearer and add a sentence about the two-factor authentication option available on the settings page.';
  const { code, err } = run(repoDir, longButRoutine);
  expect('long but no signal: exit 0', code, 0);
  expectNotContains('long but no signal: no nudge', err, 'big ask detected');
}

// 4. Has a scope word but too short → no nudge (AC4: signal alone is not enough)
{
  const { code, err } = run(repoDir, 'redesign the button');
  expect('scope word but too short: exit 0', code, 0);
  expectNotContains('scope word but too short: no nudge', err, 'big ask detected');
}

// 5. "from scratch" variant
{
  const fromScratch = 'We need to rewrite the payments module from scratch. The current implementation is too tightly coupled to the legacy billing system and needs a full end-to-end replacement that works with the new provider API.';
  const { code, err } = run(repoDir, fromScratch);
  expect('from scratch + long: exit 0', code, 0);
  expectContains('from scratch + long: nudge fires', err, 'big ask detected');
}

// 6. "overhaul" variant
{
  const overhaul = 'Can you overhaul the permissions system? It needs to support RBAC across every service in the platform, replacing the current flat model with a hierarchical one that handles inheritance and delegation throughout the whole codebase.';
  const { code, err } = run(repoDir, overhaul);
  expect('overhaul + long: exit 0', code, 0);
  expectContains('overhaul + long: nudge fires', err, 'big ask detected');
}

// ── Unadopted repo ─────────────────────────────────────────────────────────────

const unadoptedDir = makeRepo({ adopt: false });

// 7. Unadopted repo → no-op regardless of how big the ask is
{
  const bigAsk = 'Redesign the entire authentication architecture across the whole system and migrate every service to use the new identity provider. This will touch every module.';
  const { code, err } = run(unadoptedDir, bigAsk);
  expect('unadopted: exit 0', code, 0);
  expectNotContains('unadopted: no nudge', err, 'big ask detected');
}

// ── Malformed payload ──────────────────────────────────────────────────────────

// 8. Malformed JSON → fail-open (exit 0, no crash)
{
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: repoDir,
    input: 'not-json{{{',
    encoding: 'utf8',
  });
  expect('malformed payload: exit 0', result.status, 0);
}

// 9. Empty payload object → no nudge, no crash
{
  const { code, err } = run(repoDir, '');
  expect('empty prompt: exit 0', code, 0);
  expectNotContains('empty prompt: no nudge', err, 'big ask detected');
}

// ── Cleanup ────────────────────────────────────────────────────────────────────
try { rmSync(repoDir, { recursive: true, force: true }); } catch { /* best-effort */ }
try { rmSync(unadoptedDir, { recursive: true, force: true }); } catch { /* best-effort */ }

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll tests passed');
}
