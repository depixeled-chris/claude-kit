// Shared helpers for the claude-kit Node hooks. Portable across machines — no
// bash/python, no OS-shell path quirks (the bug that silently disabled the
// earlier bash hooks). Each hook reads the tool payload from stdin, decides, and
// exits: code 2 = block, 0 = allow.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
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

// A project's canonical name: the .claude-project pointer (centralized projects) else the
// repo's directory name (local projects).
export function projectName(root) {
  try {
    const m = readFileSync(join(root, '.claude-project'), 'utf8').match(/^project:[ \t]*(.+)$/m);
    if (m) return m[1].trim();
  } catch {
    /* no pointer — a local project; fall back to the dir name */
  }
  return basename(root);
}

// Working-tree temperature for a repo: uncommitted (porcelain) + unpushed (local-only)
// commits, as raw lists — callers format. git/push-state is part of the tracked record:
// a resume must see what isn't yet committed or pushed, anywhere (D-010).
export function wipSummary(repoRoot) {
  const dirty = git(['-C', repoRoot, 'status', '--porcelain']).trim();
  const unpushed = git(['-C', repoRoot, 'log', '--branches', '--not', '--remotes', '--oneline']).trim();
  return {
    clean: !dirty && !unpushed,
    dirty: dirty ? dirty.split('\n') : [],
    unpushed: unpushed ? unpushed.split('\n') : [],
  };
}

// Multi-line working-tree readout for one repo, shared by orient (single-project resume)
// and survey (cross-project deep view) so the format is defined once.
export const WIP_FILES = 12; // uncommitted files listed before collapsing to "+N more"
export const WIP_COMMITS = 10; // unpushed commits listed
export function formatWip(label, repoRoot, files = WIP_FILES, commits = WIP_COMMITS) {
  const s = wipSummary(repoRoot);
  if (s.clean) return `${label}: clean + pushed`;
  const lines = [`${label}:`];
  if (s.dirty.length) {
    lines.push(`  ${s.dirty.length} uncommitted —`);
    s.dirty.slice(0, files).forEach((l) => lines.push(`    ${l}`));
    if (s.dirty.length > files) lines.push(`    …+${s.dirty.length - files} more`);
  }
  if (s.unpushed.length) {
    lines.push(`  ${s.unpushed.length} unpushed (local-only) commit(s) —`);
    s.unpushed.slice(0, commits).forEach((l) => lines.push(`    ${l}`));
  }
  return lines.join('\n');
}

// watch_repos from a repo's .ai/config.yml (paths relative to the repo root) — extra repos
// (e.g. a backport target) whose working-tree state a resume should also surface.
export function watchRepos(root) {
  try {
    const m = readFileSync(join(root, '.ai', 'config.yml'), 'utf8').match(/watch_repos:[ \t]*\[([^\]]*)\]/);
    if (m) return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  } catch {
    /* no config / no key */
  }
  return [];
}

// Cross-project lineage from a repo's .ai/lineage.yml — how this project relates to others
// (the engine it builds on, an ancestor it descends from, sibling apps, dead repos to avoid).
// Surfaced on resume so a blank context reads it instead of reconstructing it. Tolerant
// line-by-line parse (no YAML dep), mirroring watchRepos. Returns [] on any error.
export function readLineage(root) {
  let lines;
  try {
    lines = readFileSync(join(root, '.ai', 'lineage.yml'), 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
  const items = [];
  let cur = null;
  for (const ln of lines) {
    const start = ln.match(/^[ \t]*-[ \t]+name:[ \t]*["']?(.+?)["']?[ \t]*$/);
    if (start) {
      cur = { name: start[1].trim(), role: '', note: '', url: '', path: '' };
      items.push(cur);
      continue;
    }
    if (!cur) continue;
    const kv = ln.match(/^[ \t]+([a-z]+):[ \t]*["']?(.*?)["']?[ \t]*$/);
    if (kv && Object.prototype.hasOwnProperty.call(cur, kv[1])) cur[kv[1]] = kv[2].trim();
  }
  return items;
}

// Machine-local project registry: maps each project name -> its repo path ON THIS MACHINE,
// plus the central data root when one is in use. NOT committed anywhere — repo paths are
// machine-specific (Windows drive letters vs macOS paths) while the .ai data syncs across
// machines, so a path written on one machine would be a lie on the other. Self-healed by
// orient whenever a project is opened (T-001). Best-effort: a read returns an empty registry
// on any error; a write never throws.
// CLAUDE_KIT_REGISTRY overrides the path so the test harness can isolate from the real one.
export const REGISTRY = process.env.CLAUDE_KIT_REGISTRY || join(homedir(), '.claude', 'claude-kit-projects.json');

export function readRegistry() {
  try {
    const r = JSON.parse(readFileSync(REGISTRY, 'utf8'));
    return { dataRoot: r.dataRoot || null, projects: r.projects || {} };
  } catch {
    return { dataRoot: null, projects: {} };
  }
}

export function recordProject(name, repoRoot, dataRoot) {
  if (!name || !repoRoot) return;
  try {
    const reg = readRegistry();
    let changed = false;
    if (reg.projects[name] !== repoRoot) {
      reg.projects[name] = repoRoot;
      changed = true;
    }
    if (dataRoot && reg.dataRoot !== dataRoot) {
      reg.dataRoot = dataRoot;
      changed = true;
    }
    if (!changed) return;
    mkdirSync(dirname(REGISTRY), { recursive: true });
    writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
  } catch {
    /* registry is best-effort — never break a hook */
  }
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
