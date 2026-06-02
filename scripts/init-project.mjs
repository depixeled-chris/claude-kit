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
const target = resolve(process.argv[2] || process.cwd());
const DATA = process.env.CLAUDE_DATA || '';
const MARKER = '## Workflow contract (.ai/)';

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
} else if (existsSync(aiDst)) {
  console.log('• .ai/ already exists — left untouched');
} else {
  copyDir(join(TEMPLATE, '.ai'), aiDst);
  console.log('• .ai/ scaffolded (local; set CLAUDE_DATA to centralize)');
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
