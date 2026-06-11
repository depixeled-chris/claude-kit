// Harness-memory ⇄ committed-memory unification (KIT-T016 / KIT-D016 + KIT-D002).
//
// KIT-D016: a project's memory is COMMITTED at <repo>/.claude/memory (so it syncs across
// machines); the harness writes NEW memory machine-locally to ~/.claude/projects/<encoded>/memory.
// The two are unified by a link. KIT-D002 — "enforce, don't remember" — says do NOT trust a
// one-time manual link: a fresh machine that skips it writes memory locally and loses it silently.
// These helpers are the shared truth behind orient (detect + self-heal on SessionStart) and
// bootstrap (heal every known project on adoption). Extracted to its own atomic module so the
// shared-helper hub (lib.mjs) stays under the file-length gate; lib.mjs re-exports the surface.
//
// Every export is FAIL-OPEN: any fs/path slip returns the inert result and never throws — a
// durability helper must never wedge a shell/session (the hook contract).

import { existsSync, lstatSync, readdirSync, realpathSync, mkdirSync, symlinkSync, rmSync, rmdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

// The committed, synced memory dir inside a repo — the link TARGET and source of truth.
export function repoMemoryDir(projRoot) {
  return join(projRoot, '.claude', 'memory');
}

// The harness's machine-local auto-memory dir for a project: ~/.claude/projects/<encoded>/memory,
// where <encoded> is the ABSOLUTE project path with :, \, /, and spaces collapsed to '-' (the
// harness's own scheme — the same transform housekeeping uses for the global memory key, but
// applied to the project root, not $HOME). CLAUDE_HOME overrides ~/.claude so a test can isolate it.
export function harnessMemoryDir(projRoot) {
  const claudeHome = process.env.CLAUDE_HOME || join(homedir(), '.claude');
  const encoded = String(projRoot).replace(/[:\\/ ]/g, '-');
  return join(claudeHome, 'projects', encoded, 'memory');
}

// realpathSync, lower-cased so a Windows junction (whose drive-letter case can differ) compares
// equal to its target. Returns null when the path can't be resolved (missing / broken link).
function realLower(p) {
  try {
    return realpathSync(p).toLowerCase();
  } catch {
    return null;
  }
}

// Does a path exist as a REAL directory (not a symlink/junction)? Tells a genuine divergent copy
// from a link we may safely replace. lstat (no follow) is what distinguishes the two.
function isRealDir(p) {
  try {
    const st = lstatSync(p);
    return st.isDirectory() && !st.isSymbolicLink();
  } catch {
    return false;
  }
}

function dirHasEntries(p) {
  try {
    return readdirSync(p).length > 0;
  } catch {
    return false;
  }
}

// The lstat of a path WITHOUT following the link, or null if nothing is there. lstat sees a
// DANGLING link node (target gone) that existsSync — which follows — would miss. unifyMemory
// needs this to clear a stale link before re-linking (else symlink throws EEXIST).
function lstatOrNull(p) {
  try {
    return lstatSync(p);
  } catch {
    return null;
  }
}

// Remove whatever occupies a path — a real directory, a live OR dangling dir-junction/symlink, or
// a file symlink — cross-platform. fs.rmSync({recursive}) is NOT enough: on Windows it silently
// fails to remove a DANGLING directory junction (it tries to recurse the vanished target and
// no-ops the link node), leaving an EEXIST landmine for the next symlink. So unlink a non-dir link
// first, rmdir a dir-link/empty-dir (unlinks the junction node without following), and only fall
// back to recursive rmSync for a real populated directory. Best-effort: never throws.
function removePathEntry(p) {
  const st = lstatOrNull(p);
  if (!st) return;
  try {
    if (st.isSymbolicLink() && !st.isDirectory()) { unlinkSync(p); return; }
    rmdirSync(p); // a junction / dir-symlink / empty real dir — drops the node, no target follow
  } catch {
    try { rmSync(p, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

// Classify the unification between a repo's committed memory and the harness's machine-local
// auto-memory. Returns { status, repoDir, harnessDir } where status is one of:
//   'no-repo-memory' — the repo has no .claude/memory to unify TO (e.g. an .ai-only project);
//                      nothing to do, callers stay silent.
//   'unified'        — the harness dir resolves (realpath) to the same place as the repo dir
//                      (it's a link to it, or literally the same real path). The good state.
//   'absent'         — the repo dir exists but the harness side is NOT unified and holds no
//                      real memory (missing, a stale/broken link, or an empty placeholder dir).
//                      Safe to auto-create the link.
//   'diverged'       — BOTH sides are real, non-empty, differing directories: a machine that
//                      split and wrote memory locally. NEVER auto-clobber — surface loudly.
// FAIL-OPEN: any error degrades to 'no-repo-memory' (the inert, do-nothing classification).
export function memoryUnification(projRoot) {
  if (!projRoot) return { status: 'no-repo-memory', repoDir: '', harnessDir: '' };
  const repoDir = repoMemoryDir(projRoot);
  const harnessDir = harnessMemoryDir(projRoot);
  try {
    if (!existsSync(repoDir)) return { status: 'no-repo-memory', repoDir, harnessDir };
    const repoReal = realLower(repoDir);
    const harnessReal = realLower(harnessDir);
    if (repoReal && harnessReal && repoReal === harnessReal) return { status: 'unified', repoDir, harnessDir };
    if (isRealDir(harnessDir) && dirHasEntries(harnessDir) && harnessReal !== repoReal) {
      return { status: 'diverged', repoDir, harnessDir };
    }
    return { status: 'absent', repoDir, harnessDir };
  } catch {
    return { status: 'no-repo-memory', repoDir, harnessDir };
  }
}

// The exact, copy-pasteable command that links the harness dir to the repo's committed memory —
// junction on Windows (no admin/Developer-Mode needed, works C:→D:), symlink on POSIX. Shown in
// the orient warning so a divergence (which we won't auto-resolve) has a one-line manual fix.
export function memoryLinkCommand(projRoot) {
  const repoDir = repoMemoryDir(projRoot);
  const harnessDir = harnessMemoryDir(projRoot);
  if (process.platform === 'win32') {
    return `(after backing up ${harnessDir}) Remove-Item -Recurse -Force "${harnessDir}"; ` +
      `New-Item -ItemType Junction -Path "${harnessDir}" -Target "${repoDir}"`;
  }
  return `(after backing up "${harnessDir}") rm -rf "${harnessDir}" && ln -s "${repoDir}" "${harnessDir}"`;
}

// Ensure the harness auto-memory dir is unified with the repo's committed memory — the ENFORCE
// side of KIT-D002. Idempotent + cross-platform:
//   • already 'unified' or 'no-repo-memory' → no-op.
//   • 'absent' → create the parent, drop any stale link / empty placeholder dir, and link
//     harnessDir → repoDir (junction on Windows, symlink elsewhere).
//   • 'diverged' → do NOT touch it (real memory would be lost); report it for the caller to
//     surface. Linking is the maintainer's call once they've reconciled the two copies.
// Returns { status, action, repoDir, harnessDir } where action ∈ 'none' | 'linked' | 'diverged'
// | 'failed'. FAIL-OPEN: a link error returns action 'failed', never throws.
export function unifyMemory(projRoot) {
  const u = memoryUnification(projRoot);
  if (u.status === 'unified' || u.status === 'no-repo-memory') return { ...u, action: 'none' };
  if (u.status === 'diverged') return { ...u, action: 'diverged' };
  try {
    mkdirSync(dirname(u.harnessDir), { recursive: true });
    // Clear any occupant — a stale/dangling link or an empty placeholder dir — so symlink has a
    // clear path. (memoryUnification already proved it's not a real dir with content to protect.)
    removePathEntry(u.harnessDir);
    symlinkSync(u.repoDir, u.harnessDir, process.platform === 'win32' ? 'junction' : 'dir');
    return { ...u, action: 'linked' };
  } catch {
    return { ...u, action: 'failed' };
  }
}
