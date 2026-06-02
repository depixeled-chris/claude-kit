// Shared helpers for the claude-kit Node hooks. Portable across machines — no
// bash/python, no OS-shell path quirks (the bug that silently disabled the
// earlier bash hooks). Each hook reads the tool payload from stdin, decides, and
// exits: code 2 = block, 0 = allow.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

export async function readStdin() {
  const chunks = [];
  try {
    for await (const c of process.stdin) chunks.push(c);
  } catch {
    /* no stdin (e.g. SessionStart) */
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function payload() {
  try {
    return JSON.parse(await readStdin());
  } catch {
    return {};
  }
}

export function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

export function gitRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], cwd).trim();
}

// A repo has adopted the workflow iff it has .ai/ (or a legacy root ROADMAP.md).
// Every hook no-ops on unadopted repos, so the global install never interferes.
export function adopted(root) {
  return !!root && (existsSync(join(root, '.ai')) || existsSync(join(root, 'ROADMAP.md')));
}

// Generated/dependency trees no quality check should touch.
export const VENDORED = /\/(node_modules|vendor|\.venv|venv|dist|build|target|\.git)\//;

const ROOT_MARKERS = ['package.json', 'pyproject.toml', 'Cargo.toml', 'go.mod', 'CMakeLists.txt', '.git'];

// Nearest ancestor holding a project marker; falls back to the start dir.
export function projectRoot(startDir) {
  let dir = startDir;
  for (;;) {
    if (ROOT_MARKERS.some((m) => existsSync(join(dir, m)))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
}

// Is a CLI tool on PATH? Shell-free: Windows has `where.exe`; elsewhere walk PATH.
// (No `sh -c command -v` — that would invoke a shell.)
export function have(tool) {
  if (process.platform === 'win32') {
    try {
      execFileSync('where', [tool], { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  return (process.env.PATH || '').split(':').some((d) => d && existsSync(join(d, tool)));
}

// Run a command for {code, out}; never throws (a linter's non-zero exit is data,
// not a crash). No shell — args go through as an array, so paths with spaces or
// shell metacharacters cannot be interpreted (no injection surface).
export function runStatus(cmd, args, cwd) {
  try {
    return { code: 0, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
}

// Combined output only, for callers that don't care about the exit code.
export function run(cmd, args, cwd) {
  return runStatus(cmd, args, cwd).out;
}

// A node-ecosystem CLI's bin entry, resolved so it can run as `node <bin.js>` —
// shell-free, so it works for .cmd-shimmed global installs on Windows (which
// execFileSync cannot spawn directly) as well as project-local installs.
function binFromPkgDir(pkgDir, tool) {
  try {
    let bin = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')).bin;
    if (bin && typeof bin === 'object') bin = bin[tool] ?? Object.values(bin)[0];
    return typeof bin === 'string' ? join(pkgDir, bin) : null;
  } catch {
    return null;
  }
}

export function nodeCli(tool, cwd) {
  try {
    const pjPath = createRequire(join(cwd, 'package.json')).resolve(`${tool}/package.json`);
    const local = binFromPkgDir(dirname(pjPath), tool);
    if (local) return local;
  } catch {
    /* not installed locally — try a global install below */
  }
  if (process.platform === 'win32') {
    const shim = run('where', [tool], cwd).split(/\r?\n/)[0].trim();
    return shim ? binFromPkgDir(join(dirname(shim), 'node_modules', tool), tool) : null;
  }
  // POSIX: the global bin is an executable JS shim with a node shebang; node
  // strips the shebang of the entry file, so running it via node is uniform.
  const dirs = (process.env.PATH || '').split(':');
  const hit = dirs.find((d) => d && existsSync(join(d, tool)));
  return hit ? join(hit, tool) : null;
}

export const MAINT_LOG = join(homedir(), '.claude', 'maintenance-gaps.log');

// Append a maintenance gap once. Dedup on the (kind, file, detail) triple,
// ignoring the timestamp prefix — so a recurring gap is recorded a single time.
export function logGap(kind, file, detail) {
  const row = `${kind}\t${file}\t${detail}`;
  try {
    const existing = existsSync(MAINT_LOG) ? readFileSync(MAINT_LOG, 'utf8') : '';
    if (existing.split('\n').some((l) => l.endsWith(row))) return;
    appendFileSync(MAINT_LOG, `${new Date().toISOString()}\t${row}\n`);
  } catch {
    /* gap logging is best-effort — never let it break a hook */
  }
}
