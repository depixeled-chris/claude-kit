#!/usr/bin/env node
// code-graph.mjs — a language-agnostic, dependency-free code graph (KIT-T012). The
// code-side analogue of the .ai work graph + the KIT-T004 cache: a DERIVED, regenerable
// index an agent queries ("who imports X", "where is symbol Y", "public surface of M")
// instead of grepping and opening files.
//
//   node code-graph.mjs [root] [--out graph.json]        # build + print/write the graph
//   node code-graph.mjs [root] --query importers-of <path>
//   node code-graph.mjs [root] --query defines <symbol>
//   node code-graph.mjs [root] --query surface <path>
//   node code-graph.mjs [root] --query duplicate-defines <symbol>   # twins; flags the dead one
//   node code-graph.mjs [root] --query entry-points                 # app roots (multi-root smell)
//
// "Any language" by design (maintainer constraint): extraction is a DATA table of
// per-family patterns plus a generic fallback applied to every file, so an unknown
// language still yields imports + definitions. Accuracy is heuristic (line-based, no
// parser) — the tree-sitter/ctags upgrade for precise call edges is the opt-in path
// noted in KIT-T012. Nothing here adds a runtime dependency.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative, extname, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadTreeSitter } from './treesitter.mjs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'target', 'dist', 'build', '.venv', 'venv', '__pycache__',
  '.cache', 'vendor', '.next', 'coverage',
]);

// Per-family extraction rules. `imports` capture a module/path string (group 1);
// `defs` capture a symbol name (group 1) with a kind. The GENERIC rules below run on
// every file too, so any language gets at least a best-effort graph.
const FAMILIES = [
  {
    name: 'js',
    exts: ['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx'],
    imports: [
      /^\s*import\b[^'"]*['"]([^'"]+)['"]/,
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/,
      /^\s*export\b[^'"]*\bfrom\s+['"]([^'"]+)['"]/,
    ],
    defs: [
      [/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/, 'function'],
      [/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, 'class'],
      [/^\s*(?:export\s+)?(?:abstract\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/, 'type'],
      [/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/, 'const'],
    ],
  },
  {
    name: 'python',
    exts: ['.py'],
    imports: [/^\s*import\s+([\w.]+)/, /^\s*from\s+([\w.]+)\s+import\b/],
    defs: [
      [/^\s*def\s+([A-Za-z_]\w*)/, 'function'],
      [/^\s*class\s+([A-Za-z_]\w*)/, 'class'],
    ],
  },
  {
    name: 'rust',
    exts: ['.rs'],
    imports: [/^\s*use\s+([\w:]+)/, /^\s*(?:pub\s+)?mod\s+(\w+)/],
    defs: [
      [/^\s*(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/, 'function'],
      [/^\s*(?:pub\s+)?(?:struct|enum|trait|type)\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
  {
    name: 'go',
    exts: ['.go'],
    imports: [/^\s*import\s+(?:[\w.]+\s+)?["`]([^"`]+)["`]/],
    defs: [
      [/^\s*func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, 'function'],
      [/^\s*type\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
  {
    name: 'c-family',
    exts: ['.c', '.h', '.cc', '.cpp', '.cxx', '.hpp', '.java', '.cs'],
    imports: [/^\s*#\s*include\s+[<"]([^>"]+)[>"]/, /^\s*import\s+([\w.]+);/],
    defs: [
      [/^\s*(?:public|private|protected|static|final|\s)*\bclass\s+([A-Za-z_]\w*)/, 'class'],
      [/^\s*(?:struct|enum|interface)\s+([A-Za-z_]\w*)/, 'type'],
    ],
  },
];

// Generic fallback for ANY language: catches common shapes the families miss (and
// gives unknown extensions a usable graph). Conservative to limit false positives.
const GENERIC = {
  imports: [/\b(?:import|include|require|use|using)\b[^'"`<]*['"`<]([^'"`>]+)['">`]/],
  defs: [
    [/^\s*(?:export\s+|pub\s+|public\s+)?(?:func|fn|def|function|sub|proc)\s+([A-Za-z_]\w*)/, 'function'],
    [/^\s*(?:export\s+|pub\s+|public\s+)?(?:class|struct|interface|trait|type|enum)\s+([A-Za-z_]\w*)/, 'type'],
  ],
};

const TEXT_EXT = new Set([
  ...FAMILIES.flatMap((f) => f.exts),
  '.kt', '.swift', '.rb', '.php', '.scala', '.sh', '.lua', '.dart', '.vue', '.svelte', '.zig',
]);

function familyFor(ext) {
  return FAMILIES.find((f) => f.exts.includes(ext)) || null;
}

// Prefer git for the file list: `ls-files` (tracked) + untracked-but-not-ignored. This
// respects .gitignore AND excludes submodule internals for free (a submodule is one
// gitlink entry, not its files). Returns absolute source paths, or null if `root` isn't
// a git repo / git is unavailable — caller falls back to a raw FS walk.
function gitFiles(root) {
  try {
    const opts = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    const tracked = execFileSync('git', ['ls-files'], opts);
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], opts);
    const rels = (tracked + untracked).split(/\r?\n/).filter(Boolean);
    if (!rels.length) return null;
    return rels
      .filter((r) => TEXT_EXT.has(extname(r)))
      .map((r) => join(root, r));
  } catch {
    return null; // not a git repo, or git missing
  }
}

function walk(root, acc = []) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.ai') {
      if (SKIP_DIRS.has(e.name)) continue;
    }
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(root, e.name), acc);
    } else if (TEXT_EXT.has(extname(e.name))) {
      acc.push(join(root, e.name));
    }
  }
  return acc;
}

async function extractFile(absPath, root, ts) {
  const ext = extname(absPath);
  const fam = familyFor(ext);
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);

  // Imports stay heuristic (language-agnostic, works well) regardless of tree-sitter.
  const importRules = [...(fam ? fam.imports : []), ...GENERIC.imports];
  const imports = new Set();
  for (const line of lines) {
    for (const re of importRules) {
      const m = line.match(re);
      if (m && m[1]) imports.add(m[1]);
    }
  }

  // Symbols + references: precise via tree-sitter when available for this language,
  // else the heuristic def patterns (no references).
  let symbols = [];
  let refs = [];
  let precise = false;
  if (ts) {
    const r = await ts.extract(ext, text);
    if (r) {
      symbols = r.symbols;
      refs = r.refs;
      precise = true;
    }
  }
  if (!precise) {
    const defRules = [...(fam ? fam.defs : []), ...GENERIC.defs];
    const seen = new Set();
    lines.forEach((line, i) => {
      for (const [re, kind] of defRules) {
        const m = line.match(re);
        if (m && m[1]) {
          const key = `${m[1]}:${i}`;
          if (!seen.has(key)) {
            seen.add(key);
            symbols.push({ name: m[1], kind, line: i + 1 });
          }
        }
      }
    });
    symbols.sort((a, b) => a.line - b.line);
  }

  return {
    path: relative(root, absPath).split(sep).join('/'),
    lang: fam ? fam.name : ext.replace('.', '') || 'unknown',
    imports: [...imports].sort(),
    symbols,
    refs,
    precise,
  };
}

// Resolve a relative import (./ or ../) to a repo file path, trying common extensions
// and index files. Bare specifiers (packages, std modules) stay as external nodes.
function resolveImport(spec, fromFileAbs, root, fileSet) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFileAbs), spec);
  const candidates = [base];
  for (const ext of TEXT_EXT) candidates.push(base + ext);
  for (const ext of TEXT_EXT) candidates.push(join(base, 'index' + ext));
  for (const c of candidates) {
    const rel = relative(root, c).split(sep).join('/');
    if (fileSet.has(rel)) return rel;
  }
  return null;
}

// Absolute paths of the source files for a repo (git-aware when possible, else a walk).
// Exported so the maintenance hook can stat them for a cheap staleness check without
// reading + parsing every file.
export function listSourceFiles(root) {
  const absRoot = resolve(root);
  return gitFiles(absRoot) || walk(absRoot);
}

export async function buildGraph(root) {
  const absRoot = resolve(root);
  const paths = listSourceFiles(absRoot);
  const ts = await loadTreeSitter(); // null → heuristic floor
  // Sequential: the tree-sitter parser is a single shared instance (setLanguage mutates it).
  const files = [];
  try {
    for (const f of paths) files.push(await extractFile(f, absRoot, ts));
  } finally {
    if (ts && ts.dispose) ts.dispose(); // free WASM handles (avoid the Windows exit abort)
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  const fileSet = new Set(files.map((f) => f.path));
  const edges = [];
  for (const f of files) {
    const fromAbs = join(absRoot, f.path);
    for (const spec of f.imports) {
      const to = resolveImport(spec, fromAbs, absRoot, fileSet);
      edges.push({ from: f.path, to: to || spec, kind: 'import', external: !to });
    }
  }
  edges.sort((a, b) => a.from.localeCompare(b.from) || String(a.to).localeCompare(String(b.to)));
  return { root: absRoot.split(sep).join('/'), files, edges, precise: files.some((f) => f.precise) };
}

// Verify a CODEMAP against the graph instead of generating it: full generation would
// destroy CODEMAP's hand-curated columns (role, layer, and especially gift-status — the
// open-core boundary), which a code graph can't infer. This catches drift so the doc
// can't silently go stale (retiring the manual "always update" rule) while preserving
// the editorial content. Coarse on purpose: a file is "documented" if its path, its
// basename, or any ancestor dir is mentioned in the CODEMAP text.
export function codemapCheck(graph, codemapText) {
  const codeExts = new Set([...TEXT_EXT]);
  const tokens = [...codemapText.matchAll(/`([^`]+)`/g)]
    .map((m) => m[1].trim())
    .filter((t) => /[/.]/.test(t) && !t.includes(' '))
    .map((t) => t.replace(/\/$/, ''));
  const paths = graph.files.map((f) => f.path);

  const globToRe = (t) =>
    new RegExp('^' + t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

  // A token matches a file path if it's the path, a basename, a prefix-omitted path
  // (CODEMAP often drops a leading `src/`), a dir prefix/segment, or a glob hit. This
  // tolerance is why CODEMAP can write `entities/Player.ts` for `src/entities/Player.ts`.
  const matches = (t, p) => {
    if (t.includes('*')) return globToRe(t).test(p) || globToRe(t).test(p.split('/').pop());
    return (
      p === t ||
      p.split('/').pop() === t ||
      p.endsWith('/' + t) ||
      p.startsWith(t + '/') ||
      p.includes('/' + t + '/')
    );
  };

  const undocumented = paths.filter((p) => !tokens.some((t) => matches(t, p)));
  // Stale only flags tokens that LOOK like code (a known code extension) yet match no
  // file — so legitimately-documented docs/dirs/symbol-mentions aren't false-flagged.
  const stale = tokens.filter(
    (t) => !t.includes('*') && codeExts.has(extname(t)) && !paths.some((p) => matches(t, p)),
  );
  return { undocumented, stale };
}

export function importersOf(graph, path) {
  return graph.edges.filter((e) => e.to === path).map((e) => e.from);
}
export function defines(graph, symbol) {
  return graph.files
    .filter((f) => f.symbols.some((s) => s.name === symbol))
    .map((f) => f.path);
}
export function surface(graph, path) {
  const f = graph.files.find((x) => x.path === path);
  return f ? f.symbols : [];
}
// Files that reference a symbol (precise call/macro edges) — only populated where the
// tree-sitter layer ran; empty under the heuristic floor.
export function referencesOf(graph, symbol) {
  return graph.files.filter((f) => (f.refs || []).includes(symbol)).map((f) => f.path);
}

// The top-level directory segment of a repo-relative path ('' for a root file). Two
// definitions "live in the same subtree" when they share this — the cheap proxy for "one
// editor's own closure" used to tell a self-referential twin from a shipped one.
function topDir(path) {
  const i = path.indexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

// duplicate-defines (KIT-T079) — the same exported symbol DEFINED in 2+ files (two
// `createRoadEditor`, one canonical + one superseded). The lived failure: an agent edited
// one of two twins blind because the kit offered no fast "is this duplicated / which is
// dead?" signal. This makes it ONE query off the existing graph (no new parser): list every
// definer of `symbol`, then mark the SUPERSEDED one(s).
//
// Superseded heuristic: a twin whose ONLY inbound importers live in its own top-level
// subtree (self-referential closure, or nothing imports it at all) is the dead branch — no
// shipped code outside it reaches in. A twin imported from OUTSIDE its subtree is canonical.
// Conservative on purpose: when EVERY definer looks self-contained (common under the import
// heuristic, or for genuine root-level entry files), none is flagged `superseded` — the
// agent still sees both twins and runs `git log` / `importers-of`, never a false "this is
// dead". Returns [] when the symbol is defined in 0–1 files (not a duplicate). Never throws.
export function duplicateDefines(graph, symbol) {
  try {
    const definers = (graph.files || []).filter((f) => (f.symbols || []).some((s) => s.name === symbol));
    if (definers.length < 2) return []; // not duplicated — nothing to disambiguate
    const importersByPath = new Map(definers.map((f) => [f.path, importersOf(graph, f.path)]));
    const rows = definers.map((f) => {
      const importers = importersByPath.get(f.path) || [];
      const mine = topDir(f.path);
      const external = importers.filter((p) => topDir(p) !== mine);
      return { path: f.path, importers, externalImporters: external, superseded: external.length === 0 };
    });
    // Don't declare a twin dead if NO twin has an outside importer — that's "can't tell",
    // not "this one is superseded". Only flag when at least one sibling IS reached from
    // outside, making the unreferenced one the clear dead branch.
    const anyExternal = rows.some((r) => r.externalImporters.length > 0);
    if (!anyExternal) for (const r of rows) r.superseded = false;
    return rows.sort((a, b) => Number(a.superseded) - Number(b.superseded) || a.path.localeCompare(b.path));
  } catch {
    return []; // fail-open: a cold/odd graph yields no signal, never a throw
  }
}

// Filenames/patterns that ARE an application entry point (the thing a bundler/runtime starts
// from). Multiple of these is the multi-root smell behind the lived failure — two `index.html`
// / two `main.tsx` meant two apps, and "which one am I editing?" went unanswered for turns.
const ENTRY_BASENAMES = new Set(['index.html', 'main.ts', 'main.tsx', 'main.js', 'main.jsx', 'index.tsx', 'index.jsx']);
const ENTRY_CONFIG_RE = /(?:^|\/)(?:vite|webpack|rollup|rspack|esbuild|next)\.config\.[mc]?[jt]s$/;

// entry-points (KIT-T079) — enumerate app roots so "is there more than one X?" is one command.
// Scans the FULL git-aware source list (not just the graph's parsed files) because `index.html`
// isn't a parsed code file yet still marks a root. Groups by top-level subtree so two roots in
// two trees (the duplicated-editor shape) read at a glance. `multiRoot` is the signal to chase
// provenance. Never throws — returns an empty, well-formed result on any error.
export function entryPoints(root, graph = null) {
  try {
    const absRoot = resolve(root);
    const files = listSourceFiles(absRoot).map((p) => relative(absRoot, p).split(sep).join('/'));
    // Pull in index.html (+ any non-TEXT_EXT roots) that the parsed graph omits, via a raw walk
    // of the git list; listSourceFiles already filters to TEXT_EXT, so add an html sweep.
    const htmlRoots = htmlEntryFiles(absRoot);
    const all = [...new Set([...files, ...htmlRoots])];
    const entries = all
      .filter((p) => ENTRY_BASENAMES.has(p.split('/').pop()) || ENTRY_CONFIG_RE.test(p))
      .sort();
    const byTree = {};
    for (const p of entries) (byTree[topDir(p) || '.'] ||= []).push(p);
    return { entries, byTree, multiRoot: Object.keys(byTree).length > 1 };
  } catch {
    return { entries: [], byTree: {}, multiRoot: false };
  }
}

// index.html (and other non-code roots) from the git file list — listSourceFiles drops them
// because they aren't TEXT_EXT, but they're the clearest "an app starts here" marker. Git-aware
// (respects .gitignore / submodules); falls back to an html-only walk in a non-git dir. The walk
// here is separate from `walk()` because that one is TEXT_EXT-gated and would drop .html. Best-effort.
function htmlEntryFiles(absRoot) {
  try {
    const opts = { cwd: absRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    try {
      const tracked = execFileSync('git', ['ls-files'], opts);
      const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], opts);
      return (tracked + untracked).split(/\r?\n/).filter(Boolean).map((r) => r.split(sep).join('/')).filter((r) => r.endsWith('.html'));
    } catch {
      return walkHtml(absRoot).map((p) => relative(absRoot, p).split(sep).join('/'));
    }
  } catch {
    return [];
  }
}

function walkHtml(root, acc = []) {
  for (const e of readdirSync(root, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    if (e.isDirectory()) walkHtml(join(root, e.name), acc);
    else if (extname(e.name) === '.html') acc.push(join(root, e.name));
  }
  return acc;
}

async function main() {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let out = null;
  let query = null;
  let queryArg = null;
  let codemap = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else if (args[i] === '--query') { query = args[++i]; queryArg = args[++i]; }
    else if (args[i] === '--codemap-check') codemap = args[++i];
    else if (!args[i].startsWith('--')) root = args[i];
  }
  const graph = await buildGraph(root);

  if (codemap) {
    const { undocumented, stale } = codemapCheck(graph, readFileSync(codemap, 'utf8'));
    if (!undocumented.length && !stale.length) {
      process.stdout.write(`codemap-check: clean (${graph.files.length} files vs ${codemap})\n`);
      return;
    }
    if (undocumented.length) process.stderr.write(`UNDOCUMENTED (in code, not in CODEMAP):\n  ${undocumented.join('\n  ')}\n`);
    if (stale.length) process.stderr.write(`STALE (in CODEMAP, not in code):\n  ${stale.join('\n  ')}\n`);
    process.exit(1);
  }

  if (query) {
    let result;
    if (query === 'importers-of') result = importersOf(graph, queryArg);
    else if (query === 'defines') result = defines(graph, queryArg);
    else if (query === 'references-of') result = referencesOf(graph, queryArg);
    else if (query === 'surface') result = surface(graph, queryArg);
    else if (query === 'duplicate-defines') result = duplicateDefines(graph, queryArg);
    else if (query === 'entry-points') result = entryPoints(root, graph);
    else {
      console.error(`unknown query '${query}' (importers-of | defines | references-of | surface | duplicate-defines | entry-points)`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  const json = JSON.stringify(graph, null, 2);
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, json);
    const mode = graph.precise ? 'precise (tree-sitter)' : 'heuristic';
    process.stdout.write(`code-graph: ${graph.files.length} files, ${graph.edges.length} edges, ${mode} -> ${out}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
}

// Run main only as a CLI, not when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('code-graph: ' + (e && e.message ? e.message : e));
    process.exit(1);
  });
}
