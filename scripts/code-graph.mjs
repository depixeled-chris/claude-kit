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

function extractFile(absPath, root) {
  const ext = extname(absPath);
  const fam = familyFor(ext);
  const importRules = [...(fam ? fam.imports : []), ...GENERIC.imports];
  const defRules = [...(fam ? fam.defs : []), ...GENERIC.defs];
  const text = readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const imports = new Set();
  const symbols = [];
  const seenSym = new Set();
  lines.forEach((line, i) => {
    for (const re of importRules) {
      const m = line.match(re);
      if (m && m[1]) imports.add(m[1]);
    }
    for (const [re, kind] of defRules) {
      const m = line.match(re);
      if (m && m[1]) {
        const key = `${m[1]}:${i}`;
        if (!seenSym.has(key)) {
          seenSym.add(key);
          symbols.push({ name: m[1], kind, line: i + 1 });
        }
      }
    }
  });
  return {
    path: relative(root, absPath).split(sep).join('/'),
    lang: fam ? fam.name : ext.replace('.', '') || 'unknown',
    imports: [...imports].sort(),
    symbols: symbols.sort((a, b) => a.line - b.line),
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

export function buildGraph(root) {
  const absRoot = resolve(root);
  // git-aware list (respects .gitignore, skips submodule internals) when available;
  // otherwise a plain recursive walk.
  const paths = gitFiles(absRoot) || walk(absRoot);
  const files = paths.map((f) => extractFile(f, absRoot)).sort((a, b) => a.path.localeCompare(b.path));
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
  return { root: absRoot.split(sep).join('/'), files, edges };
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

function main() {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let out = null;
  let query = null;
  let queryArg = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') out = args[++i];
    else if (args[i] === '--query') { query = args[++i]; queryArg = args[++i]; }
    else if (!args[i].startsWith('--')) root = args[i];
  }
  const graph = buildGraph(root);

  if (query) {
    let result;
    if (query === 'importers-of') result = importersOf(graph, queryArg);
    else if (query === 'defines') result = defines(graph, queryArg);
    else if (query === 'surface') result = surface(graph, queryArg);
    else {
      console.error(`unknown query '${query}' (importers-of | defines | surface)`);
      process.exit(2);
    }
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  const json = JSON.stringify(graph, null, 2);
  if (out) {
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(out, json);
    process.stdout.write(`code-graph: ${graph.files.length} files, ${graph.edges.length} edges -> ${out}\n`);
  } else {
    process.stdout.write(json + '\n');
  }
}

// Run main only as a CLI, not when imported by the tests.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
