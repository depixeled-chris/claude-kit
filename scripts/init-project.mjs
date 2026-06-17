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
//
// LAB scope (--lab <name>): creates a repo-less scope in the centralized data store.
//   node /path/to/claude-kit/scripts/init-project.mjs --lab <name>
//   Requires CLAUDE_DATA. Scaffolds $CLAUDE_DATA/projects/<name>/ directly (no junction,
//   no code repo), writes config.yml with `lab: true`, seeds standard .ai/ structure.

import {
  existsSync, mkdirSync, readdirSync, statSync,
  copyFileSync, readFileSync, writeFileSync, appendFileSync, symlinkSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGitHooks } from './install-git-hooks.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(KIT, 'project-template');

// Parse positional arg and --key=ABC / --lab flags.
const args = process.argv.slice(2);
const keyFlag = args.find((a) => a.startsWith('--key='));
const labFlag = args.find((a) => a === '--lab');
const positional = args.find((a) => !a.startsWith('--'));
const FLAG_KEY = keyFlag ? keyFlag.slice('--key='.length).trim().toUpperCase() : '';

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

// Seed the central data dir from the template if it doesn't exist yet.
// Exported so both the normal centralized path and --lab can call it.
export function seedCentralDataDir(dataDir) {
  if (existsSync(dataDir)) {
    console.log(`• data dir exists: ${dataDir}`);
    return false; // already existed
  }
  copyDir(join(TEMPLATE, '.ai'), dataDir);
  console.log(`• data dir seeded from template: ${dataDir}`);
  return true;
}

// Set ids.key + ids.prefix in config.yml when the key is still the placeholder.
// FLAG_KEY overrides derivation; derivation falls back to `nameHint`.
export function seedProjectKey(aiDir, nameHint) {
  const cfgPath = join(aiDir, 'config.yml');
  if (!existsSync(cfgPath)) return;
  const text = readFileSync(cfgPath, 'utf8');

  // Only act when the key is still the literal placeholder — never clobber a real key.
  const km = text.match(/^([ \t]*key:[ \t]*)["']?([A-Za-z0-9]+)["']?([ \t]*)$/m);
  if (!km || km[2] !== KEY_PLACEHOLDER) {
    console.log(`• ids.key already set — left as-is`);
    return;
  }

  const key = FLAG_KEY || deriveKey(nameHint || basename(aiDir));
  const prefix = `${key}-T`;
  const updated = text
    .replace(/^([ \t]*key:[ \t]*)["']?KEY["']?([ \t]*)$/m, `$1"${key}"$2`)
    .replace(/^([ \t]*prefix:[ \t]*)["']?KEY-T["']?([ \t]*)$/m, `$1"${prefix}"$2`);
  writeFileSync(cfgPath, updated);
  console.log(`• ids.key=${key}  ids.prefix=${prefix}  (derived from "${nameHint || basename(aiDir)}"${FLAG_KEY ? '; --key override' : ''})`);
}

// Stamp `lab: true` at the top of config.yml (after any leading comments, before the
// first non-comment content) when not already present.
export function stampLabFlag(cfgPath) {
  if (!existsSync(cfgPath)) return;
  const text = readFileSync(cfgPath, 'utf8');
  if (/^lab:\s*true\s*$/m.test(text)) {
    console.log('• lab: true already present in config.yml');
    return;
  }
  // Insert before the first non-comment, non-blank line.
  const lines = text.split('\n');
  let insertAt = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t && !t.startsWith('#')) { insertAt = i; break; }
  }
  lines.splice(insertAt, 0, 'lab: true');
  writeFileSync(cfgPath, lines.join('\n'));
  console.log('• lab: true stamped into config.yml');
}

// ---- LAB mode (--lab <name>) ------------------------------------------------
if (labFlag) {
  if (!positional) {
    console.error('usage: init-project.mjs --lab <name>');
    process.exit(1);
  }
  if (!DATA) {
    console.error('--lab requires CLAUDE_DATA to be set (the centralized data store).');
    process.exit(1);
  }
  const name = positional;
  const dataDir = join(DATA, 'projects', name);
  seedCentralDataDir(dataDir);
  seedProjectKey(dataDir, name);
  stampLabFlag(join(dataDir, 'config.yml'));
  console.log(`\nDone (lab scope "${name}" at ${dataDir}).`);
  process.exit(0);
}

// ---- Normal repo-adoption mode ---------------------------------------------

const target = resolve(positional || process.cwd());

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
  seedCentralDataDir(dataDir);
  writeFileSync(join(target, '.claude-project'), `project: ${name}\n`);
  console.log(`• .claude-project -> ${name}`);
  if (existsSync(aiDst)) {
    console.log('• .ai already present — left as-is (verify it points at the data dir)');
  } else {
    symlinkSync(dataDir, aiDst, process.platform === 'win32' ? 'junction' : 'dir');
    console.log(`• .ai linked -> ${dataDir}`);
  }
  seedProjectKey(dataDir, name);
} else if (existsSync(aiDst)) {
  console.log('• .ai/ already exists — left untouched');
  seedProjectKey(aiDst, basename(target));
} else {
  copyDir(join(TEMPLATE, '.ai'), aiDst);
  console.log('• .ai/ scaffolded (local; set CLAUDE_DATA to centralize)');
  seedProjectKey(aiDst, basename(target));
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

// Install the native git hooks on the adopted repo (fail-open — a hook install failure
// must never fail init). For centralized mode the data repo is also a git repo (and it's
// where item changes land), so install there too when CLAUDE_DATA is set. KIT-T097.
try {
  await installGitHooks(target);
} catch {
  /* fail-open */
}
if (DATA) {
  try {
    const { centralDataRoot } = await import('../hooks/lib.mjs');
    const dataRepo = centralDataRoot(target) || DATA;
    if (dataRepo && dataRepo !== target) await installGitHooks(dataRepo);
  } catch {
    /* fail-open */
  }
}

console.log(`\nDone (${DATA ? 'centralized' : 'local'}).`);
