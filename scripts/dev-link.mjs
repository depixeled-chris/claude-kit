#!/usr/bin/env node
// dev-link — point the INSTALLED claude-kit plugin at this working repo, so edits go
// live on `/reload-plugins` alone: no marketplace update, no version bump, no reinstall.
// The published plugin and every other machine are unaffected — this only relinks the
// local install dir to the repo. Reversible.
//
//   node scripts/dev-link.mjs           # link the install dir -> this repo
//   node scripts/dev-link.mjs --unlink  # restore the frozen snapshot
//
// After linking: edit the repo, run /reload-plugins, done. (`/plugin update` will
// replace the link with a fresh snapshot — just re-run dev-link to re-link.)

import { readFileSync, existsSync, rmSync, renameSync, symlinkSync, lstatSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KEY = 'claude-kit@claude-kit';
const reg = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');

let entry;
try {
  const data = JSON.parse(readFileSync(reg, 'utf8'));
  entry = ((data.plugins && data.plugins[KEY]) || [])[0];
} catch {
  /* no registry */
}
if (!entry || !entry.installPath) {
  console.error(`${KEY} is not installed — run /plugin install ${KEY} first.`);
  process.exit(1);
}
const installPath = entry.installPath;
const bak = installPath + '.snapshot-bak';
const linked = () => {
  try { return lstatSync(installPath).isSymbolicLink(); } catch { return false; }
};

if (process.argv.includes('--unlink')) {
  if (linked()) {
    rmSync(installPath, { recursive: true, force: true });
    if (existsSync(bak)) renameSync(bak, installPath);
    console.log('unlinked — frozen snapshot restored. /reload-plugins to apply.');
  } else {
    console.log('not dev-linked — nothing to do.');
  }
  process.exit(0);
}

if (linked()) {
  console.log(`already dev-linked: ${installPath} -> ${REPO}`);
  process.exit(0);
}
if (existsSync(installPath) && !existsSync(bak)) renameSync(installPath, bak);
else if (existsSync(installPath)) rmSync(installPath, { recursive: true, force: true });
symlinkSync(REPO, installPath, process.platform === 'win32' ? 'junction' : 'dir');
console.log(`dev-linked: ${installPath}\n         -> ${REPO}\n\nLoop is now: edit the repo, /reload-plugins. (node scripts/dev-link.mjs --unlink to revert.)`);
