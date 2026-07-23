// centralize.mjs — the primitives that put a project's .ai in the central store and wire
// the repo to it: the recursive copy, the .ai junction, the .claude-project pointer, and
// the gitignore entries. Shared by init-project (fresh adoption) and reconcile-central
// (back-fill of an already-in-repo notebook) so centralized-mode wiring has ONE home
// (KIT-T134 — the earlier duplication is what let the two paths drift).

import {
  existsSync, mkdirSync, readdirSync, statSync,
  copyFileSync, readFileSync, writeFileSync, appendFileSync, symlinkSync,
} from 'node:fs';
import { join } from 'node:path';

// Paths a centralized repo keeps out of git: the .ai junction itself (its content lives in
// the data repo, not here) plus the machine-local/secret files. Local mode ignores only
// .ai/SECRETS* — the notebook there IS the tracked copy.
export const CENTRAL_GITIGNORE = ['.ai', 'CLAUDE.local.md', '.claude/settings.local.json', '.claude/journal/'];
export const LOCAL_GITIGNORE = ['.ai/SECRETS*', 'CLAUDE.local.md', '.claude/settings.local.json'];

export function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const entry of readdirSync(src)) {
    const s = join(src, entry);
    const d = join(dst, entry);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// The .ai junction (Windows) / dir symlink (POSIX) from a repo into its central store dir.
export function linkAiJunction(target, dataDir) {
  symlinkSync(dataDir, join(target, '.ai'), process.platform === 'win32' ? 'junction' : 'dir');
}

// Write the tracked .claude-project pointer that names the project (projectName's source).
export function writeProjectPointer(target, name) {
  writeFileSync(join(target, '.claude-project'), `project: ${name}\n`);
}

// Append any missing entries under a single "# claude-kit" section; returns the count added
// (0 when the file already covers everything). Idempotent — re-running never duplicates.
export function updateGitignore(target, wants) {
  const gi = join(target, '.gitignore');
  const giText = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
  const missing = wants.filter((w) => !giText.split('\n').includes(w));
  if (missing.length) {
    appendFileSync(gi, (giText && !giText.endsWith('\n') ? '\n' : '') + '\n# claude-kit\n' + missing.join('\n') + '\n');
  }
  return missing.length;
}
