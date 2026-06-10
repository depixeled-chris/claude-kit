#!/usr/bin/env node
// PreToolUse (Write|Edit) — file-class-aware quality gate. Code gets code checks;
// docs get a broken-link check; license/meta + data/config are skipped. Portable
// (no awk/python). exit 2 = block, 0 = allow. Warnings go to stderr with exit 0.

import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { payload, projectRoot, pathExcluded, markerExcludedLines, excludeFooter, VENDORED, LOCKFILES, fileExt } from './lib.mjs';

// Fail-open guard (KIT-T055): an unexpected throw anywhere below must never wedge a
// write. The HOOK CONTRACT requires EXPLICIT fail-open; before this, an uncaught throw
// exited 1 and was non-blocking only by exit-code accident.
const failOpen = (e) => {
  process.stderr.write(`[pre-write] internal error — failing open: ${(e && e.message) || e}\n`);
  process.exit(0);
};
process.on('uncaughtException', failOpen);
process.on('unhandledRejection', failOpen);

const MAX_SHOWN = 5;
const MAX_SQL = 3;
const FILE_HARD = 800;
const FILE_SOFT = 400;
const ALLOWED = new Set(['-1', '0', '1', '2']);
const NATIVE_LINTED = new Set(['rs', 'py', 'go', 'sh', 'bash', 'zsh']);
const DOC = new Set(['md', 'markdown', 'mdx', 'txt', 'rst', 'adoc']);
const DATA = new Set(['json', 'jsonl', 'yaml', 'yml', 'toml', 'xml', 'csv', 'ini', 'cfg']);
const MARKUP = new Set(['html', 'htm', 'xhtml', 'svg']); // markup, not logic — numbers in text/attrs aren't magic constants
// Plain CSS has no first-class variables (custom properties are optional), so a one-off
// literal value (font-size: 30px) is idiomatic, not a magic number — exempt it.
const PLAIN_STYLE = new Set(['css']);
// Preprocessors DO have variables. A spacing/color/breakpoint literal reused across the
// file should be a token, and literals inside @if/@for/@function logic are real magic
// numbers — these get a stylesheet-aware check below, not a blanket pass.
const PREPROC_STYLE = new Set(['scss', 'sass', 'less', 'styl']);
const REPEAT_STYLE = 3; // a literal used this many times should become a variable/token
// less variables are `@name:`; these at-rules are NOT variable declarations.
const AT_KEYWORDS = new Set([
  'media', 'import', 'include', 'if', 'else', 'each', 'for', 'while', 'mixin',
  'function', 'return', 'use', 'forward', 'content', 'extend', 'supports',
  'keyframes', 'charset', 'namespace', 'font-face', 'page', 'warn', 'error',
  'debug', 'at-root', 'apply', 'layer', 'container', 'property',
]);

// Blank every NON-CODE span — string/template/char literals and line/block comments —
// to spaces, preserving newlines so line numbers are unchanged. A single forward scan
// (not per-line regex) is what lets it span multi-line template literals/heredocs and
// /* */ blocks, the case that leaked prose numerals into the magic-number scan. Covers
// JS/TS/C-family ("…", '…', `…` w/ \ escapes; // and /* */), shell/python/ruby (# line),
// SQL/Lua/Ada (-- line). Deliberately conservative and self-contained; any throw is
// caught by the caller's fail-open guard so a hook never wedges a write.
function codeOnly(src) {
  const out = Array.from(src);
  const blank = (i) => { if (out[i] !== '\n') out[i] = ' '; };
  // Keywords a regex literal may directly follow (`return /x/`) — after any OTHER
  // identifier, `/` is division.
  const REGEX_AFTER = new Set(['return', 'case', 'typeof', 'in', 'of', 'delete', 'void', 'do', 'else']);
  let i = 0;
  let prev = '('; // last structural char — drives the regex-vs-division call (KIT-T077)
  let word = ''; // trailing identifier, for the keyword check
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') { blank(i); if (i + 1 < n) blank(i + 1); i += 2; continue; }
        blank(i); i++;
      }
      i++; // closing quote (or EOF)
      prev = quote; // a `/` right after a string is division, not a regex
      continue;
    }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    // Regex literal (KIT-T077): `/` is a regex START only after an operator/opener —
    // after an identifier/number it's division, which must stay visible to the scan.
    // A newline before the closing `/` means we misjudged: bail, blank nothing.
    if (c === '/' && d !== '*' && (/[=(,[{;:!&|?+\-*%<>^~]/.test(prev) || REGEX_AFTER.has(word))) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== '\n') {
        const ch = src[j];
        if (ch === '\\') { j += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        j++;
      }
      if (j < n && src[j] === '/') {
        while (i <= j) { blank(i); i++; }
        while (i < n && /[a-z]/.test(src[i])) { blank(i); i++; } // flags
        prev = ')'; // a regex VALUE ends like a closing expression
        continue;
      }
    }
    if (c === '#') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    if (c === '-' && d === '-') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    if (c === '/' && d === '*') {
      blank(i); blank(i + 1); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { blank(i); i++; }
      if (i < n) { blank(i); blank(i + 1); i += 2; }
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    if (/[A-Za-z_$]/.test(c)) word += c;
    else if (!/\s/.test(c)) word = ''; // whitespace keeps the word (`return /x/`)
    i++;
  }
  return out.join('');
}

const p = await payload();
const file = (p.tool_input && p.tool_input.file_path) || '';
const content = (p.tool_input && (p.tool_input.content ?? p.tool_input.new_string)) || '';
if (!file) process.exit(0);

const norm = file.replace(/\\/g, '/');
if (VENDORED.test(norm)) process.exit(0);
if (LOCKFILES.test(norm)) process.exit(0);
// Legacy `.claudekit-ignore` (whole-repo, every check silently off) is RETIRED
// (KIT-T057) — a blanket bypass contradicted "halts in anything but exclusions".
// Finding one now WARNS with the .claude-kit-ignore.yaml migration and is not honored.
for (let dir = dirname(norm); ; ) {
  if (existsSync(resolve(dir, '.claudekit-ignore'))) {
    process.stderr.write(
      `WARN [pre-write] legacy .claudekit-ignore found at ${dir} — RETIRED (KIT-T057), no longer honored.\n` +
        'Migrate to .claude-kit-ignore.yaml at the repo root — per-check globs, e.g.:\n' +
        '  magic-numbers:\n    - "src/**"\n' +
        'or, ONLY if every check truly must be off repo-wide:\n' +
        '  "*":\n    - "**"\n' +
        'Then delete .claudekit-ignore. Template: .claude-kit-ignore.yaml.example\n',
    );
    break;
  }
  const parent = dirname(dir);
  if (parent === dir) break;
  dir = parent;
}
const base = basename(norm);
if (/^(LICENSE|COPYING|NOTICE|AUTHORS)(\..*)?$/.test(base)) process.exit(0);

const ext = fileExt(norm);

// Unified exclusion (KIT-T051): a check is skipped for this file when its path matches a
// glob under that check-id (or '*') in .claude-kit-ignore.yaml, OR the whole file is
// excluded by an in-source marker. Line-keyed checks (magic-numbers, file-length) ALSO
// honor block/line markers via excludedAt below. Fail-open throughout.
const ROOT = projectRoot(dirname(file));
const excludedFile = (id) =>
  pathExcluded(ROOT, id, file) || markerExcludedLines(content, id).wholeFile;
const markedLines = (id) => markerExcludedLines(content, id).lines;
const excludedAt = (id, lineNo) => excludedFile(id) || markedLines(id).has(lineNo);

// DOC files: the check that actually rots docs — relative links with no target.
if (DOC.has(ext)) {
  if (excludedFile('broken-doc-links')) process.exit(0);
  const dir = dirname(file);
  const bad = [];
  for (const m of content.matchAll(/\]\(([^)]+)\)/g)) {
    let t = m[1].trim().split(/\s+/)[0];
    if (/^(https?:\/\/|mailto:|tel:|#|\/\/|data:)/.test(t)) continue;
    t = t.split('#')[0];
    if (!t) continue;
    const target = isAbsolute(t) ? t : resolve(dir, t);
    if (!existsSync(target)) bad.push(t);
  }
  if (bad.length) {
    process.stderr.write(
      `WARN broken doc links in ${file}: ${[...new Set(bad)].join('; ')}\n` +
        '(Dead relative links rot the doc web — fix or correct the reference. Edit proceeds.)\n' +
        excludeFooter('broken-doc-links'),
    );
  }
  process.exit(0);
}
if (DATA.has(ext) || MARKUP.has(ext) || PLAIN_STYLE.has(ext)) process.exit(0); // config/data/markup/plain-css is not logic-source

// Shared reporter: warnings to stderr (exit 0), violations block (exit 2).
// Entries are { id, msg } so every message can name its check for exclusion.
function finish(viols, warns) {
  if (warns.length) {
    process.stderr.write(
      `WARN pre-write (${file}):\n` + warns.map((w) => '-- ' + w.msg + excludeFooter(w.id)).join('\n') + '\n',
    );
  }
  if (viols.length) {
    process.stderr.write(
      `\nBLOCKED: pre-write check failed for ${file}\n\n` +
        viols.map((v) => '-- ' + v.msg + excludeFooter(v.id)).join('\n') +
        '\nFix before the write proceeds; if you believe it is a false positive, exclude it (above) or STOP and discuss.\n',
    );
    process.exit(2);
  }
  process.exit(0);
}

// Preprocessor stylesheets: literals that should be variables/tokens. Same concept,
// same check-id (`magic-numbers`) — exclusions apply uniformly across both flavors.
if (PREPROC_STYLE.has(ext)) {
  if (excludedFile('magic-numbers')) process.exit(0);
  const styleLines = content.split('\n');
  const isVarDecl = (l) => {
    if (/^\s*\$[\w-]+\s*:/.test(l)) return true; // scss  $name:
    if (/^\s*--[\w-]+\s*:/.test(l)) return true; // custom property --name:
    if (ext === 'styl' && /^\s*[\w-]+\s*=\s*[^=]/.test(l)) return true; // stylus name =
    const m = l.match(/^\s*@([\w-]+)\s*:/); // less @name: (but not @media/@include/...)
    return !!m && !AT_KEYWORDS.has(m[1].toLowerCase());
  };
  const tokensOf = (l) => {
    const out = [];
    for (const m of l.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) out.push(m[0].toLowerCase()); // colors
    const cleaned = l.replace(/#[0-9a-fA-F]{3,8}\b/g, '').replace(/"[^"]*"/g, '').replace(/'[^']*'/g, '');
    for (const m of cleaned.matchAll(/(?<![\w.$@#-])(\d+(?:\.\d+)?)(px|em|rem|%|vh|vw|vmin|vmax|ms|deg|fr|pt|ch|ex|rad|turn)?/g)) {
      const num = m[1];
      if (num === '0' || num === '1') continue; // 0 and unitless 1 are not tokens
      out.push(num + (m[2] || ''));
    }
    return out;
  };
  const count = new Map();
  const seenAt = new Map();
  const sViols = [];
  const sWarns = [];
  for (let i = 0; i < styleLines.length; i++) {
    const l = styleLines[i];
    if (/^\s*(\/\/|\*|\/\*)/.test(l)) continue; // comment
    if (excludedAt('magic-numbers', i + 1)) continue;
    // literals inside preprocessor logic are magic numbers regardless of repetition
    if (/^\s*@(if|else|while|for|return|function)\b/.test(l) && /[^A-Za-z0-9_.#-]\d/.test(l)) {
      sWarns.push({ id: 'magic-numbers', msg: `Literal in stylesheet logic (extract a variable):\n${i + 1}: ${l.trim()}` });
    }
    if (isVarDecl(l)) continue; // the declaration line is the literal's rightful home
    for (const tok of tokensOf(l)) {
      count.set(tok, (count.get(tok) || 0) + 1);
      if (!seenAt.has(tok)) seenAt.set(tok, i + 1);
    }
  }
  const repeated = [...count.entries()].filter(([, c]) => c >= REPEAT_STYLE).sort((a, b) => b[1] - a[1]).slice(0, MAX_SHOWN);
  if (repeated.length) {
    sViols.push({
      id: 'magic-numbers',
      msg:
        'Repeated literals — extract a variable/token (spacing, color, breakpoint):\n' +
        repeated.map(([tok, c]) => `  ${tok} used ${c}× (first at line ${seenAt.get(tok)})`).join('\n'),
    });
  }
  finish(sViols, sWarns.slice(0, MAX_SHOWN));
}

const isTest = /(\.test\.|\.spec\.|\/__tests__\/|\/tests?\/)/.test(norm);
const isMig = /\/(migrations|alembic\/versions)\//.test(norm);
const lines = content.split('\n');
const viols = []; // { id, msg } — id names the check so excludeFooter can cite it
const warns = [];
// Line-keyed pick: gathers [lineNo, line] hits, dropping any line excluded for `id`
// (path-glob OR in-source marker), capped at `cap`.
const pick = (id, re, cap = MAX_SHOWN) => {
  if (excludedFile(id)) return [];
  const out = [];
  for (let i = 0; i < lines.length && out.length < cap; i++) {
    if (re.test(lines[i]) && !excludedAt(id, i + 1)) out.push([i + 1, lines[i]]);
  }
  return out;
};
const show = (hits) => hits.map(([n, l]) => `${n}: ${l.trim()}`).join('\n');

// claude-kit-ignore-start all
// This gate's OWN check definitions name the very tokens/patterns it flags (the rot
// markers, the dead-code traces, SELECT-shaped SQL). Excluding the block here is the
// canonical dogfood of the KIT-T051 in-source marker — without it the gate blocks its
// own source.
// 1. rot markers
const todo = pick('todo-markers', /\b(TODO|FIXME|XXX|HACK)\b/);
if (todo.length) viols.push({ id: 'todo-markers', msg: 'TODO/FIXME/XXX/HACK markers are not allowed in source:\n' + show(todo) });

// 2. dead-code trace comments
const dead = pick('dead-code', /^\s*(\/\/|#|--)\s*(removed|was:|deprecated:|old:|previously:)/i);
if (dead.length) viols.push({ id: 'dead-code', msg: 'Dead-code trace comments (delete it; git is the record):\n' + show(dead) });

// 3. magic numbers — skip native-linted langs, tests, migrations.
// Scan only EXECUTABLE CODE: numerics inside string/template literals, heredocs, and
// comments are prose, not constants (the KIT-T032 false positive — orient.mjs's prose
// heredoc carried "60-75k"/"70k"/"5-line"). `codeOnly` blanks every non-code span
// (keeping newlines so line numbers stay true) so the scan never sees those. The
// declaration/assignment skips below stay line-keyed against the ORIGINAL line.
if (!NATIVE_LINTED.has(ext) && !isTest && !isMig && !excludedFile('magic-numbers')) {
  const codeLines = codeOnly(content).split('\n');
  const hits = [];
  for (let i = 0; i < lines.length && hits.length < MAX_SHOWN; i++) {
    const raw = lines[i];
    const code = codeLines[i] ?? '';
    if (!/\d/.test(code)) continue; // no numerics survived stripping → all prose/comment
    if (excludedAt('magic-numbers', i + 1)) continue; // glob/marker-excluded line
    if (/\b(const|constexpr|let|var|final|#define|enum|static|readonly)\b/.test(raw)) continue; // declaration
    if (/^\s*[A-Za-z_]\w*\s*[:=][^=]/.test(raw)) continue; // name: / name=
    // KIT-T077 precision: values that are NAMED at the use site, or pure data rows.
    if (/^[\s\d.,;[\]{}()-]+$/.test(raw)) continue; // continuation row of a multi-line initializer
    if (/[A-Za-z_$][\w$.\])]*\s*(?<![=!<>])[:=](?!=)\s*-?\.?\d/.test(raw)) continue; // `opts.timeout = 5000`, `(attempts = 5)`, `{retries: 3}` — comparisons excluded
    if (/\b(parseInt|toString)\s*\([^)]*\d+\s*\)/.test(raw)) continue; // radix argument
    const stripped = code.replace(/\d+(px|em|rem)/g, '');
    const m = stripped.match(/[^A-Za-z0-9_.](-?\d+(\.\d+)?)/);
    if (m && !ALLOWED.has(m[1])) hits.push(`${i + 1}: ${raw.trim()}`);
  }
  if (hits.length) {
    viols.push({ id: 'magic-numbers', msg: 'Magic numbers (allowed bare: -1, 0, 1, 2). Extract named constants:\n' + hits.join('\n') });
  }
}

// 4. SELECT *
const star = pick('select-star', /select\s+\*\s+from/i, MAX_SQL);
if (star.length) viols.push({ id: 'select-star', msg: 'SELECT * detected (enumerate columns):\n' + show(star) });

// 5. string-built SQL (warn — human review)
const sqlStr = pick('sql-injection', /(f"[^"]*\b(SELECT|INSERT|UPDATE|DELETE)\b|`[^`]*\${[^}]+}[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b)/, MAX_SQL);
if (sqlStr.length) warns.push({ id: 'sql-injection', msg: 'POSSIBLE string-built SQL (injection risk — parameterize/review):\n' + show(sqlStr) });
// claude-kit-ignore-end

// 6. file length — file-keyed; a path glob or whole-file marker exempts it.
if (!excludedFile('file-length')) {
  if (lines.length > FILE_HARD) viols.push({ id: 'file-length', msg: `File length ${lines.length} exceeds hard limit ${FILE_HARD} — split into cohesive modules.` });
  else if (lines.length > FILE_SOFT) warns.push({ id: 'file-length', msg: `File length ${lines.length} exceeds soft limit ${FILE_SOFT} — consider splitting.` });
}

finish(viols, warns);
