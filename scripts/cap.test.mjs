#!/usr/bin/env node
// Tests for cap.mjs — the sub-second capture script.
// Drives the REAL CLI in a throwaway adopted temp repo so the full arg-parsing +
// file-write path is exercised end-to-end. exit 0 = all pass. (KIT-T013)

import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const CAP = fileURLToPath(import.meta.url).replace(/\.test\.mjs$/, '.mjs');

let pass = 0;
let fail = 0;
const fixtures = [];

function ok(name, cond) {
  if (cond) { pass++; console.log('  ok    ' + name); }
  else       { fail++; console.log('  FAIL  ' + name); }
}

// Minimal config.yml — just enough for classificationKeys() to recognise `bug`.
const MIN_CONFIG = `classifications:
  bug:     { routes_to: tickets, priority: high, blocking: when-touching-active }
  feature: { routes_to: backlog, priority: medium, blocking: never }
ids:
  key: "TST"
  prefix: "TST-T"
  pad: 3
`;

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'kit-cap-'));
  fixtures.push(root);
  mkdirSync(join(root, '.ai', 'inbox'),   { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), MIN_CONFIG);
  return root;
}

function cap(repo, args) {
  return execFileSync(process.execPath, [CAP, ...args], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_KIT_REGISTRY: join(tmpdir(), 'no-registry-for-cap-test.json') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

// --------------------------------------------------------------------------
// 1. cap --done (untyped) writes to resolved/, NOT inbox/
// --------------------------------------------------------------------------
console.log('\ncap --done (untyped) writes to resolved/');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'already fixed the moon']);
  const resolvedFiles = existsSync(join(repo, '.ai', 'resolved'))
    ? readdirSync(join(repo, '.ai', 'resolved')) : [];
  const inboxFiles = readdirSync(join(repo, '.ai', 'inbox'));
  ok('resolved/ dir created', existsSync(join(repo, '.ai', 'resolved')));
  ok('one file in resolved/', resolvedFiles.length === 1);
  ok('inbox stays empty', inboxFiles.length === 0);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'resolved', resolvedFiles[0]), 'utf8');
  ok('file contains the text', content.includes('already fixed the moon'));
  ok('file contains resolved: timestamp', /^resolved:\s*\d{4}-\d{2}-\d{2}T/m.test(content));
  ok('no type prefix (untyped)', !content.startsWith('('));

  const fname = resolvedFiles[0];
  ok('filename matches YYYY-MM-DD-HHMM-slug pattern', /^\d{4}-\d{2}-\d{2}-\d{4}-/.test(fname));
}

// --------------------------------------------------------------------------
// 2. cap --done <type> <text> records type in the resolved record
// --------------------------------------------------------------------------
console.log('\ncap --done bug records type=bug in the resolved record');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'bug', 'fixed login crash']);
  const resolvedFiles = readdirSync(join(repo, '.ai', 'resolved'));
  ok('resolved file written', resolvedFiles.length === 1);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'resolved', resolvedFiles[0]), 'utf8');
  ok('type prefix present', content.startsWith('(bug)'));
  ok('text present', content.includes('fixed login crash'));
  ok('resolved: timestamp present', /^resolved:\s*\d{4}-\d{2}-\d{2}T/m.test(content));
}

// --------------------------------------------------------------------------
// 3. cap (no --done) still writes to inbox/ exactly as before
// --------------------------------------------------------------------------
console.log('\ncap without --done still writes to inbox/');
{
  const repo = makeRepo();
  cap(repo, ['normal capture without done flag']);
  const inboxFiles = readdirSync(join(repo, '.ai', 'inbox'));
  const resolvedExists = existsSync(join(repo, '.ai', 'resolved'));
  ok('one file in inbox/', inboxFiles.length === 1);
  ok('resolved/ not created', !resolvedExists);

  const { readFileSync } = await import('node:fs');
  const content = readFileSync(join(repo, '.ai', 'inbox', inboxFiles[0]), 'utf8');
  ok('text in inbox file', content.includes('normal capture without done flag'));
  ok('no resolved: field in inbox file', !/^resolved:/m.test(content));
}

// --------------------------------------------------------------------------
// 4. cap --done with type AND plain text in a single arg
// --------------------------------------------------------------------------
console.log('\ncap --done with quoted text works');
{
  const repo = makeRepo();
  cap(repo, ['--done', 'patched the floodgate']);
  const resolvedFiles = readdirSync(join(repo, '.ai', 'resolved'));
  ok('resolved file present for quoted text', resolvedFiles.length === 1);
}

// --------------------------------------------------------------------------
// Teardown
// --------------------------------------------------------------------------
for (const d of fixtures) {
  try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
