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
// Resolved at CALL TIME (not frozen at import) so an in-process test can set the override
// after this module loads — same reason the hooks read stdin per-invocation.
export function registryPath() {
  return process.env.CLAUDE_KIT_REGISTRY || join(homedir(), '.claude', 'claude-kit-projects.json');
}
export const REGISTRY = registryPath();

export function readRegistry() {
  try {
    const r = JSON.parse(readFileSync(registryPath(), 'utf8'));
    return { dataRoot: r.dataRoot || null, projects: r.projects || {} };
  } catch {
    return { dataRoot: null, projects: {} };
  }
}

// Every known project's .ai store directory, across ALL scopes — the cross-project
// enumeration shared by survey (briefing) and the cache hydrator (KIT-T031). A project's
// stores live either in its repo (<repo>/.ai) or in the central data root
// (<dataRoot>/projects/<name>, which IS the .ai dir, not a parent of one); resolve to
// whichever exists, preferring the repo. Returns { name, aiDir } per project with stores.
// Best-effort: any unreadable entry is skipped, never thrown.
export function projectAiDirs() {
  const reg = readRegistry();
  const names = new Set(Object.keys(reg.projects));
  if (reg.dataRoot) {
    try {
      for (const d of readdirSync(join(reg.dataRoot, 'projects'), { withFileTypes: true })) {
        if (d.isDirectory()) names.add(d.name);
      }
    } catch {
      /* no central data dir — registry-only */
    }
  }
  const out = [];
  for (const name of names) {
    const repo = reg.projects[name];
    const repoAi = repo ? join(repo, '.ai') : null;
    const centralAi = reg.dataRoot ? join(reg.dataRoot, 'projects', name) : null;
    let aiDir = null;
    if (repoAi && existsSync(repoAi)) aiDir = repoAi;
    else if (centralAi && existsSync(join(centralAi, 'config.yml'))) aiDir = centralAi;
    if (aiDir) out.push({ name, aiDir });
  }
  return out;
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
    const p = registryPath();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(reg, null, 2) + '\n');
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

// --- unified exclusion system (KIT-T051) --------------------------------------
// "Halts in anything but exclusions": every gate keeps its hard block by default;
// the ONLY non-halt path is an explicit, documented exclusion. Two surfaces, both
// dependency-free and fail-open (any error → behave as "not excluded", so a malformed
// ignore file can never wedge a write):
//   1. .claude-kit-ignore.yaml at the project root — { checkId: [glob, ...] }, plus a
//      '*' / 'all' key that excludes from EVERY check.
//   2. In-source comment markers (//, #, --) — exclude a whole file, a start..end block,
//      or a single line.

const IGNORE_FILE = '.claude-kit-ignore.yaml';

// Tolerant YAML-subset parse (no dep, mirroring loadCapture / readLineage): a top-level
// `key:` followed by `  - glob` list items. Quotes stripped. {} on missing/bad file.
export function loadIgnoreConfig(root) {
  let text;
  try {
    text = readFileSync(join(root, IGNORE_FILE), 'utf8');
  } catch {
    return {};
  }
  try {
    const out = {};
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.replace(/\t/g, '  ');
      if (!line.trim() || /^\s*#/.test(line)) continue; // blank / comment
      const key = line.match(/^([^\s#:][^:]*?):\s*(#.*)?$/); // `key:` at column 0-ish (no indent)
      if (key && !/^\s/.test(line)) {
        cur = key[1].trim().replace(/^["']|["']$/g, '');
        out[cur] = out[cur] || [];
        continue;
      }
      const item = line.match(/^\s+-\s*(.+?)\s*(#.*)?$/); // `  - glob`
      if (item && cur) {
        const g = item[1].trim().replace(/^["']|["']$/g, '').replace(/\s+#.*$/, '');
        if (g) out[cur].push(g);
      }
    }
    return out;
  } catch {
    return {}; // fail-open: a parse slip is never an exclusion
  }
}

// Minimal glob → RegExp: `**` = any depth (incl. /), `*` = within a segment, `?` = one char.
// Anchored full-match against a forward-slash path. Leading `./` and `/` are tolerated.
function globToRegExp(glob) {
  const g = glob.replace(/^\.?\//, '');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { re += '.*'; i++; if (g[i + 1] === '/') i++; }
      else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + re + '$');
}

// Does `filePath` (any form) match a glob under `checkId` or the catch-all '*'/'all'?
// fail-open: any error → false (not excluded).
export function pathExcluded(root, checkId, filePath) {
  try {
    const cfg = loadIgnoreConfig(root);
    const rel = relForGlob(root, filePath);
    const globs = [...(cfg[checkId] || []), ...(cfg['*'] || []), ...(cfg.all || [])];
    return globs.some((g) => {
      try { return globToRegExp(g).test(rel); } catch { return false; }
    });
  } catch {
    return false;
  }
}

// A repo-root-relative, forward-slash path for glob matching. Absolute paths are made
// relative to root when they live under it; a path already relative is just normalized.
function relForGlob(root, filePath) {
  let f = String(filePath).replace(/\\/g, '/');
  const r = String(root).replace(/\\/g, '/').replace(/\/$/, '');
  if (r && f.toLowerCase().startsWith(r.toLowerCase() + '/')) f = f.slice(r.length + 1);
  return f.replace(/^\.?\//, '');
}

// In-source markers in any of the //, #, -- comment styles. Returns which lines (1-based)
// a given checkId excludes, and whether the WHOLE file is excluded. A marker takes
// `<check-id>` or `all`/`*` (matches every check). Fail-open: any throw → nothing excluded.
//   claude-kit-ignore-file  <id>            -> whole file
//   claude-kit-ignore-start <id> .. -end    -> the lines BETWEEN (exclusive of the markers)
//   claude-kit-ignore-line  <id>            -> the NEXT non-marker line
//   ... code ...   // claude-kit-ignore <id> -> that same line (trailing)
export function markerExcludedLines(source, checkId) {
  const result = { wholeFile: false, lines: new Set() };
  try {
    const lines = String(source).split('\n');
    const C = '(?://|#|--)';
    const reFile = new RegExp(`${C}\\s*claude-kit-ignore-file\\s+(\\S+)`);
    const reStart = new RegExp(`${C}\\s*claude-kit-ignore-start\\s+(\\S+)`);
    const reEnd = new RegExp(`${C}\\s*claude-kit-ignore-end\\b`);
    const reLine = new RegExp(`${C}\\s*claude-kit-ignore-line\\s+(\\S+)`);
    const reTrail = new RegExp(`${C}\\s*claude-kit-ignore\\s+(\\S+)\\s*$`);
    const applies = (id) => id === checkId || id === 'all' || id === '*';
    let openFrom = -1; // 1-based line where an active start marker (matching this check) sits
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const n = i + 1;
      let m;
      if ((m = ln.match(reFile)) && applies(m[1])) { result.wholeFile = true; continue; }
      if ((m = ln.match(reStart))) { if (applies(m[1])) openFrom = n; continue; }
      if (reEnd.test(ln)) { openFrom = -1; continue; }
      if ((m = ln.match(reLine)) && applies(m[1])) { result.lines.add(n + 1); continue; }
      if ((m = ln.match(reTrail)) && applies(m[1])) { result.lines.add(n); }
      if (openFrom !== -1) result.lines.add(n);
    }
    return result;
  } catch {
    return { wholeFile: false, lines: new Set() };
  }
}

// Uniform "how to exclude" footer appended to every gate's block/warn message, so a false
// positive always has an obvious, documented escape. Names the CHECK-ID and shows BOTH
// surfaces (the YAML snippet and the in-source marker). One definition → every gate is
// consistent.
export function excludeFooter(checkId) {
  return [
    '',
    `To exclude from this check (id: ${checkId}) — add ONE:`,
    `  • path glob in .claude-kit-ignore.yaml:`,
    `      ${checkId}:`,
    `        - path/to/dir/**`,
    `  • in-source marker (// or # or --):`,
    `      // claude-kit-ignore-start ${checkId}`,
    `      ...excluded lines...`,
    `      // claude-kit-ignore-end`,
    `    (or // claude-kit-ignore-file ${checkId} | // claude-kit-ignore-line ${checkId} | trailing // claude-kit-ignore ${checkId})`,
    '',
  ].join('\n');
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
