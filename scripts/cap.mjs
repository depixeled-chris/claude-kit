#!/usr/bin/env node
// cap.mjs — sub-second capture into .ai/inbox/ from anywhere in a project. One file
// per capture (atomic — D-009); triage promotes each into tickets/decisions/etc.
//
//   cap bug login redirect loops after SSO
//   cap "form double-submits on slow network"     (untyped — classified at triage)
//   cap feature dark-mode toggle persists
//
// First token is treated as a type ONLY if it matches a classification key in
// .ai/config.yml; otherwise the whole line is captured untyped. Walks up from the
// cwd to find the nearest .ai/ directory (no git required).

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const DATE_END = 10; // slice [0,DATE_END) of an ISO string = YYYY-MM-DD
const TIME_START = 11; // HH:MM:SS begins here
const TIME_END = 16; // through the minutes
const SLUG_MAX = 48;

function findAiDir(start) {
  let dir = resolve(start);
  for (;;) {
    if (existsSync(join(dir, '.ai', 'config.yml'))) return join(dir, '.ai');
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Minimal extraction of classification keys from config.yml (no yaml dep).
function classificationKeys(configPath) {
  try {
    const lines = readFileSync(configPath, 'utf8').split('\n');
    const keys = [];
    let inBlock = false;
    for (const line of lines) {
      if (/^classifications:\s*$/.test(line)) {
        inBlock = true;
        continue;
      }
      if (inBlock) {
        if (/^\S/.test(line)) break; // next top-level key ends the block
        const m = line.match(/^\s{2}([A-Za-z][\w-]*):/);
        if (m) keys.push(m[1]);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: cap [type] <text>');
  process.exit(1);
}

const aiDir = findAiDir(process.cwd());
if (!aiDir) {
  console.error('cap: no .ai/ found above ' + process.cwd() + ' — run init-project.mjs first.');
  process.exit(1);
}

const keys = classificationKeys(join(aiDir, 'config.yml'));
let type = '';
let words = args.slice();
if (keys.includes(args[0]) && args.length > 1) {
  type = args[0];
  words = args.slice(1);
}

const iso = new Date().toISOString();
const date = iso.slice(0, DATE_END);
const time = iso.slice(TIME_START, TIME_END).replace(':', '');
const text = words.join(' ').trim();
const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, SLUG_MAX) || 'capture';

const inboxDir = join(aiDir, 'inbox');
mkdirSync(inboxDir, { recursive: true });
const name = `${date}-${time}-${slug}.md`;
writeFileSync(join(inboxDir, name), `${type ? `(${type}) ` : ''}${text}\n`);
console.log(`captured${type ? ` (${type})` : ''} -> inbox/${name}`);
