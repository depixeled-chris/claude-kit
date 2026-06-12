#!/usr/bin/env node
// init-project.mjs — wire a repo into the claude-kit workflow.
//
//   node /path/to/claude-kit/scripts/init-project.mjs [target-dir]
//
// CENTRALIZED (CLAUDE_DATA set — D-008): workflow data lives in
//   $CLAUDE_DATA/projects/<name>/; the repo gets a tracked .claude-project pointer and a
//   gitignored .ai symlink/junction into it. The data dir is seeded from the template
//   if it doesn't exist yet.
// LOCAL (no CLAUDE_DATA): scaffold .ai/ inside the repo (the original behavior).
// Both modes append CLAUDE.snippet.md to the repo's CLAUDE.md once. Idempotent.

import {
  existsSync, mkdirSync, readdirSync, statSync,
  copyFileSync, readFileSync, writeFileSync, appendFileSync, symlinkSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(KIT, 'project-template');

// Parse positional arg and --key=ABC flag. The positional must NOT start with "--".
const args = process.argv.slice(2);
const keyFlag = args.find((a) => a.startsWith('--key='));
const positional = args.find((a) => !a.startsWith('--'));
const FLAG_KEY = keyFlag ? keyFlag.slice('--key='.length).trim().toUpperCase() : '';

const target = resolve(positional || process.cwd());
const DATA = process.env.CLAUDE_DATA || '';
const MARKER = '## Workflow contract (.ai/)';

// The placeholder value the template ships. Only replace this literal string — never
// clobber a key that someone has already customised.
const KEY_PLACEHOLDER = 'KEY';

// Derive a short uppercase key from a directory/project name.
// Split on hyphens, underscores, and whitespace; take the first letter of each word.
// Single-word name → first 3 letters. Strip non-alphanumerics. Final fallback: "PRJ".
export function deriveKey(name) {
  const words = name.split(/[-_\s]+/).filter(Boolean);
  let key;
  if (words.length > 1) {
    key = words.map((w) => w[0] || '').join('');
  } else {
    key = (words[0] || '').slice(0, 3);
  }
  key = key.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  return key || 'PRJ';
}

function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

function projectName() {
  const marker = join(target, '.claude-project');
  if (existsSync(marker)) {
    const m = readFileSync(marker, 'utf8').match(/^project:[ \t]*(.+)$/m);
    if (m) return m[1].trim();
  }
  return basename(target);
}

const aiDst = join(target, '.ai');

if (DATA) {
  const name = projectName();
  const dataDir = join(DATA, 'projects', name);
  if (existsSync(dataDir)) {
    console.log(`• data dir exists: ${dataDir}`);
  } else {
    copyDir(join(TEMPLATE, '.ai'), dataDir);
    console.log(`• data dir seeded from template: ${dataDir}`);
  }
  writeFileSync(join(target, '.claude-project'), `project: ${name}\n`);
  console.log(`• .claude-project -> ${name}`);
  if (existsSync(aiDst)) {
    console.log('• .ai already present — left as-is (verify it points at the data dir)');
  } else {
    symlinkSync(dataDir, aiDst, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`• .ai linked -> ${dataDir}`);
  }
  seedProjectKey(dataDir);
} else if (existsSync(aiDst)) {
  console.log('• .ai/ already exists — left untouched');
  seedProjectKey(aiDst);
} else {
  copyDir(join(TEMPLATE, '.ai'), aiDst);
  console.log('• .ai/ scaffolded (local; set CLAUDE_DATA to centralize)');
  seedProjectKey(aiDst);
}

// Set ids.key + ids.prefix in config.yml when the key is still the placeholder.
// FLAG_KEY overrides derivation; derivation reads the project directory name.
function seedProjectKey(aiDir) {
  const cfgPath = join(aiDir, 'config.yml');
  if (!existsSync(cfgPath)) return;
  const text = readFileSync(cfgPath, 'utf8');

  // Only act when the key is still the literal placeholder — never clobber a real key.
  const km = text.match(/^([ \t]*key:[ \t]*)["']?([A-Za-z0-9]+)["']?([ \t]*)$/m);
  if (!km || km[2] !== KEY_PLACEHOLDER) {
    console.log(`• ids.key already set — left as-is`);
    return;
  }

  const key = FLAG_KEY || deriveKey(basename(target));
  const prefix = `${key}-T`;
  let updated = text
    .replace(/^([ \t]*key:[ \t]*)["']?KEY["']?([ \t]*)$/m, `$1"${key}"$2`)
    .replace(/^([ \t]*prefix:[ \t]*)["']?KEY-T["']?([ \t]*)$/m, `$1"${prefix}"$2`);
  writeFileSync(cfgPath, updated);
  console.log(`• ids.key=${key}  ids.prefix=${prefix}  (derived from "${basename(target)}"${FLAG_KEY ? '; --key override' : ''})`);
}

// CLAUDE.md — append the contract once (both modes)
const claudeMd = join(target, 'CLAUDE.md');
const snippet = readFileSync(join(TEMPLATE, 'CLAUDE.snippet.md'), 'utf8');
const existing = existsSync(claudeMd) ? readFileSync(claudeMd, 'utf8') : '';
if (existing.includes(MARKER)) {
  console.log('• CLAUDE.md already has the workflow contract — skipped');
} else if (existing) {
  appendFileSync(claudeMd, '\n\n' + snippet);
  console.log('• workflow contract appended to CLAUDE.md');
} else {
  writeFileSync(claudeMd, '# Project\n\n' + snippet);
  console.log('• CLAUDE.md created with the workflow contract');
}

// .gitignore — keep the junction + secrets/local out of git
const gi = join(target, '.gitignore');
const wants = DATA
  ? ['.ai', 'CLAUDE.local.md', '.claude/settings.local.json', '.claude/journal/']
  : ['.ai/SECRETS*', 'CLAUDE.local.md', '.claude/settings.local.json'];
const giText = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
const missing = wants.filter((w) => !giText.split('\n').includes(w));
if (missing.length) {
  appendFileSync(gi, (giText && !giText.endsWith('\n') ? '\n' : '') + '\n# claude-kit\n' + missing.join('\n') + '\n');
  console.log(`• .gitignore updated (${missing.length})`);
} else {
  console.log('• .gitignore already covers it');
}

console.log(`\nDone (${DATA ? 'centralized' : 'local'}).`);
