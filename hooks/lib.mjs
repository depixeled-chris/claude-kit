// Shared helpers for the claude-kit Node hooks. Portable across machines — no
// bash/python, no OS-shell path quirks (the bug that silently disabled the
// earlier bash hooks). Each hook reads the tool payload from stdin, decides, and
// exits: code 2 = block, 0 = allow.

import { execFileSync } from 'node:child_process';
import { existsSync, statSync, readFileSync, appendFileSync, writeFileSync, mkdirSync, readdirSync, realpathSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
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

// Compile a list of regex sources, skipping bad patterns (shared by request-gate).
export function compileSignals(patterns) {
  const out = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(p, 'i'));
    } catch {
      /* skip a bad pattern, keep the rest */
    }
  }
  return out;
}

// The `capture:` block of .ai/config.yml (tolerant YAML-subset scan, no dep) — the
// request-gate ratchet's knobs. Lives here so every config parser has one home (KIT-T059).
export function loadCaptureConfig(root, defaultSignals = []) {
  const out = { enabled: true, mode: 'block-once', signals: compileSignals(defaultSignals) };
  let text;
  try {
    text = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
  } catch {
    return out;
  }
  const block = text.match(/^capture:[ \t]*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return out;
  const body = block[1];
  if (/^\s*enabled:\s*false\b/m.test(body)) out.enabled = false;
  const mode = body.match(/^\s*mode:\s*["']?([a-z-]+)/m);
  if (mode) out.mode = mode[1];
  const sig = body.match(/^\s*signals:[ \t]*\n((?:\s*-\s*.*\n?)+)/m);
  if (sig) {
    const list = [...sig[1].matchAll(/^\s*-\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]);
    if (list.length) out.signals = compileSignals(list);
  }
  return out;
}

// Like git(), but the caller learns whether the command SUCCEEDED and sees stderr.
// For paths that must not mistake failure for empty output (KIT-T053: sync-data's
// push verification — git() swallowing a rejected push produced false receipts).
export function gitTry(args, cwd) {
  try {
    return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    const err = (e && e.stderr && e.stderr.toString()) || (e && e.message) || 'git failed';
    return { ok: false, out: err };
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

// Ahead/behind vs upstream for a repo's current branch, with an optional bounded fetch
// so cross-machine divergence is visible at session start (KIT-T054 — wipSummary alone
// is ahead-only, which made a diverged main invisible until `git pull` failed mid-task).
// Fail-open everywhere: offline fetch is swallowed (counts run against last-known remote
// refs), and no-upstream / detached HEAD return null so callers degrade gracefully.
const FETCH_TIMEOUT_MS = 4000;
export function aheadBehind(repoRoot, { fetch = false } = {}) {
  if (fetch) {
    try {
      execFileSync('git', ['-C', repoRoot, 'fetch', '--quiet'], { stdio: 'ignore', timeout: FETCH_TIMEOUT_MS });
    } catch {
      /* offline / slow / no remote — judge against the refs we have */
    }
  }
  const m = git(['-C', repoRoot, 'rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).trim().match(/^(\d+)\s+(\d+)$/);
  if (!m) return null;
  const ahead = Number(m[1]);
  const behind = Number(m[2]);
  return { ahead, behind, diverged: ahead > 0 && behind > 0 };
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

// Lockfiles / dependency manifests no content check should touch (KIT-T059 — was
// duplicated verbatim in pre-write and lint).
export const LOCKFILES = /(\.lock|\.sum)$|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|uv\.lock)$/;

// Lowercased extension of a path's basename, '' when none (was tripled across hooks).
export function fileExt(p) {
  const b = basename(String(p).replace(/\\/g, '/'));
  return b.includes('.') ? b.split('.').pop().toLowerCase() : '';
}

// The id-citation atom (<KEY>-<T|D|N|Q><num>). commit-gate and request-gate previously
// disagreed ([TDNQ]\d+ vs [A-Z]\d{1,4}) so a cite could satisfy one gate and not the
// other; both now build their regexes from this source (KIT-T059).
export const ID_CITE_SRC = String.raw`[A-Z]{2,}-[TDNQ]\d{1,4}`;

// The central data repo holding this project's .ai (the junction/symlink target), or
// null when .ai lives in-repo (local mode) / doesn't exist. Was duplicated in orient
// and sync-data with drift-prone realpath logic.
export function centralDataRoot(projRoot) {
  try {
    const ai = join(projRoot, '.ai');
    if (!existsSync(ai)) return null;
    const top = git(['-C', realpathSync(ai), 'rev-parse', '--show-toplevel']).trim();
    if (top && realpathSync(top) !== realpathSync(projRoot)) return top;
  } catch {
    /* not a junction / not a repo */
  }
  return null;
}

// Nearest ancestor whose <dir>/.ai/config.yml exists — the project whose STORE a file
// belongs to (cap/ingest semantics; distinct from projectRoot's code-project markers).
export function storeRoot(start) {
  let dir = start;
  for (;;) {
    if (existsSync(join(dir, '.ai', 'config.yml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

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
// THE one glob dialect — exclusions AND standing-decision `paths:` share it (KIT-T059).
export function globToRegExp(glob) {
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

// --- closure nags (KIT-T062) ----------------------------------------------------
// The intake side is loud (request-gate, capture ratchet); the CLOSURE side rotted
// silently (inbox sat days untriaged, review piled up, SESSION went stale). These
// shared scanners feed the SessionStart/Stop nags in housekeeping + orient. Every one
// is FAIL-OPEN: any read/parse slip returns the empty/clean result, never throws — a
// nag must never wedge a session (the hook contract).

const MS_PER_DAY = 86400000;

// Age in whole days of a path by mtime; null when it can't be stat'd.
function ageDays(path) {
  try {
    return Math.floor((Date.now() - statSync(path).mtimeMs) / MS_PER_DAY);
  } catch {
    return null;
  }
}

// Untriaged inbox: `.ai/inbox/*.md` (the triaged/ subdir + README are NOT intake).
// triage drains inbox into the durable stores, so a file lingering here past a
// threshold is un-actioned capture. Returns { total, stale, oldestDays } where `stale`
// counts files older than thresholdDays. Empty/clean ({total:0}) on any error.
export function scanInbox(root, thresholdDays) {
  const out = { total: 0, stale: 0, oldestDays: 0 };
  try {
    const dir = join(root, '.ai', 'inbox');
    const files = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
    for (const f of files) {
      const age = ageDays(join(dir, f));
      if (age === null) continue;
      out.total++;
      if (age > out.oldestDays) out.oldestDays = age;
      if (age >= thresholdDays) out.stale++;
    }
  } catch {
    /* no inbox dir / unreadable — nothing to nag about */
  }
  return out;
}

// The project's UAT resolution (KIT-D034): `required` (review IS the human acceptance
// stage — the queue waits on the human) or `none` (the agent closes directly, so no
// queue accrues). Read line-wise from .ai/config.yml — same tolerant subset the rest of
// the tooling uses, no yaml dep. Defaults to `required` (the template default) on any miss.
export function uatDefault(root) {
  try {
    const cfg = readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
    const m = cfg.match(/^uat:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+default:[ \t]*(\w+)/m);
    if (m) return m[1];
  } catch {
    /* no config — fall through to the template default */
  }
  return 'required';
}

// A ticket file's frontmatter `status` and per-ticket `uat:` override (either may be '').
// Tolerant line-wise parse mirroring survey/t — only the two fields the review scan needs.
function ticketStatusAndUat(text) {
  const fm = (text.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const pick = (k) => {
    const m = fm.match(new RegExp(`^${k}:[ \\t]*(.*)$`, 'm'));
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
  };
  return { status: pick('status'), uat: pick('uat') };
}

// Review queue = tickets parked in `status: review` whose UAT resolves `required` (so the
// stage genuinely waits on the human — a per-ticket `uat:` beats the project default). Where
// uat resolves `none` the project closes its own work, so the queue is empty BY CONSTRUCTION
// and the caller's nag stays silent. Returns { count, oldestDays, ids } (waiting-ticket count,
// the oldest by file mtime, and their ids for a short-list render). Clean ({count:0}) on any
// error or when uat is project-wide `none`.
export function scanReviewQueue(root) {
  const out = { count: 0, oldestDays: 0, ids: [] };
  try {
    const dir = join(root, '.ai', 'tickets');
    const def = uatDefault(root);
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md') || f.startsWith('_') || f === 'INDEX.md') continue;
      const path = join(dir, f);
      let text;
      try { text = readFileSync(path, 'utf8'); } catch { continue; }
      const { status, uat } = ticketStatusAndUat(text);
      if (status !== 'review') continue;
      if ((uat || def) !== 'required') continue; // `none` → not a human-waiting queue
      out.count++;
      const id = (text.match(/^id:[ \t]*(.+)$/m) || [, f.replace(/\.md$/, '')])[1].trim();
      out.ids.push(id);
      const age = ageDays(path);
      if (age !== null && age > out.oldestDays) out.oldestDays = age;
    }
  } catch {
    /* no tickets dir / unreadable — empty queue */
  }
  return out;
}

// Per-repo turn snapshot for the Stop "review queue GREW this turn" nag. SessionStart writes
// the current review count; Stop compares + rewrites it. Machine-local + disposable (the temp
// dir), keyed by a sanitized repo path so parallel projects don't collide. FAIL-OPEN: a read
// returns null (Stop then can't claim growth, so it stays silent — the safe direction); a write
// is best-effort. CLAUDE_KIT_TURN_STATE overrides the dir so the test harness can isolate it.
function turnStatePath(root) {
  const base = process.env.CLAUDE_KIT_TURN_STATE || join(tmpdir(), 'claude-kit-turnstate');
  const key = String(root).replace(/[:\\/ ]/g, '-').replace(/^-+/, '') || 'root';
  return join(base, `${key}.json`);
}

export function readTurnState(root) {
  try {
    return JSON.parse(readFileSync(turnStatePath(root), 'utf8'));
  } catch {
    return null;
  }
}

export function writeTurnState(root, state) {
  try {
    const p = turnStatePath(root);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, JSON.stringify(state) + '\n');
  } catch {
    /* turn state is best-effort — never break a hook */
  }
}

// Is SESSION.md staler than the project's last commit? The plan-of-record going stale is
// "itself a failure" per the contract, so orient surfaces it in one line. Compares SESSION's
// mtime against the last commit's author date (epoch seconds). Returns { stale, sessionDays }
// — stale only when SESSION pre-dates the last commit AND a commit exists. FAIL-OPEN: any
// missing file / git hiccup returns { stale:false } so orientation never breaks.
export function sessionStale(root) {
  try {
    const session = join(root, '.ai', 'SESSION.md');
    const sMtime = statSync(session).mtimeMs;
    const lastCommit = git(['-C', root, 'log', '-1', '--format=%ct']).trim();
    if (!lastCommit) return { stale: false, sessionDays: 0 };
    const commitMs = Number(lastCommit) * 1000;
    const sessionDays = Math.max(0, Math.floor((Date.now() - sMtime) / MS_PER_DAY));
    return { stale: sMtime < commitMs, sessionDays };
  } catch {
    return { stale: false, sessionDays: 0 };
  }
}
