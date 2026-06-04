// Optional tree-sitter precision layer for the code graph (KIT-T012 / KIT-D014). When
// `web-tree-sitter` is installed and a vendored grammar exists for the file's extension,
// this yields precise symbol DEFINITIONS (with kinds) and reference (call) names — the
// thing the line-based heuristic can't do. Everything degrades to null (→ heuristic floor)
// if web-tree-sitter is absent, the language is unsupported, or a query fails to compile.
// Grammars are VENDORED in-repo (vendor/tree-sitter-grammars/*.wasm) so no fetch/build is
// needed; web-tree-sitter is an OPTIONAL dependency.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const GRAMMARS = join(dirname(fileURLToPath(import.meta.url)), '..', 'vendor', 'tree-sitter-grammars');

const EXT_LANG = {
  '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript',
  '.ts': 'typescript', '.tsx': 'tsx', '.py': 'python', '.rs': 'rust', '.go': 'go',
};

// A capture named `def.<kind>` is a definition (kind = the part after this prefix); `ref`
// is a reference (call / macro). A wrong node-name just fails Query compilation → that
// language falls back to the heuristic.
const DEF = 'def.';
// Common to JS + TS. The class name node DIFFERS between the grammars (JS: identifier,
// TS: type_identifier), so each adds its own class pattern — a query referencing a
// node-type the grammar lacks fails to COMPILE (whole query throws → that language falls
// back), so they can't be shared blindly.
const JS_COMMON = `
  (function_declaration name: (identifier) @def.function)
  (method_definition name: (property_identifier) @def.method)
  (call_expression function: (identifier) @ref)
  (call_expression function: (member_expression property: (property_identifier) @ref))`;
const JS_DEFS = JS_COMMON + `
  (class_declaration name: (identifier) @def.class)`;
const TS_DEFS = JS_COMMON + `
  (class_declaration name: (type_identifier) @def.class)
  (interface_declaration name: (type_identifier) @def.type)
  (type_alias_declaration name: (type_identifier) @def.type)
  (enum_declaration name: (identifier) @def.type)`;
const QUERIES = {
  javascript: JS_DEFS,
  typescript: TS_DEFS,
  tsx: TS_DEFS,
  python: `
    (function_definition name: (identifier) @def.function)
    (class_definition name: (identifier) @def.class)
    (call function: (identifier) @ref)
    (call function: (attribute attribute: (identifier) @ref))`,
  rust: `
    (function_item name: (identifier) @def.function)
    (struct_item name: (type_identifier) @def.type)
    (enum_item name: (type_identifier) @def.type)
    (trait_item name: (type_identifier) @def.type)
    (call_expression function: (identifier) @ref)
    (macro_invocation macro: (identifier) @ref)`,
  go: `
    (function_declaration name: (identifier) @def.function)
    (method_declaration name: (field_identifier) @def.method)
    (type_declaration (type_spec name: (type_identifier) @def.type))
    (call_expression function: (identifier) @ref)`,
};

// Initialize once; returns an extractor, or null if tree-sitter isn't usable here.
export async function loadTreeSitter() {
  let Parser;
  try {
    const mod = await import('web-tree-sitter');
    Parser = mod.default || mod;
    await Parser.init();
  } catch {
    return null; // web-tree-sitter not installed → heuristic floor
  }

  const parser = new Parser();
  const langs = new Map(); // name -> { lang, query } | null
  async function prepare(name) {
    if (langs.has(name)) return langs.get(name);
    const wasm = join(GRAMMARS, `tree-sitter-${name}.wasm`);
    let entry = null;
    if (existsSync(wasm)) {
      try {
        const lang = await Parser.Language.load(wasm);
        entry = { lang, query: lang.query(QUERIES[name]) };
      } catch {
        entry = null; // grammar load or query compile failed → fall back for this language
      }
    }
    langs.set(name, entry);
    return entry;
  }

  return {
    /** { symbols:[{name,kind,line}], refs:[name] } for a supported file, else null. */
    async extract(ext, src) {
      const name = EXT_LANG[ext];
      if (!name) return null;
      const entry = await prepare(name);
      if (!entry) return null;
      parser.setLanguage(entry.lang);
      const tree = parser.parse(src);
      const symbols = [];
      const refs = new Set();
      for (const c of entry.query.captures(tree.rootNode)) {
        if (c.name.startsWith(DEF)) {
          symbols.push({ name: c.node.text, kind: c.name.slice(DEF.length) || 'symbol', line: c.node.startPosition.row + 1 });
        } else if (c.name === 'ref') {
          refs.add(c.node.text);
        }
      }
      if (typeof tree.delete === 'function') tree.delete();
      symbols.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
      return { symbols, refs: [...refs].sort() };
    },
    // Free WASM resources. Without this, the emscripten runtime's dangling async handles
    // abort the process on exit on Windows (libuv UV_HANDLE_CLOSING). Call when done.
    dispose() {
      try {
        parser.delete();
      } catch {
        /* already freed */
      }
      for (const entry of langs.values()) {
        try {
          entry?.query?.delete?.();
          entry?.lang?.delete?.();
        } catch {
          /* already freed */
        }
      }
    },
  };
}
