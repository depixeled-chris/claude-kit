#!/usr/bin/env node
// PreToolUse (Write|Edit) — file-class-aware quality gate. Code gets code checks;
// docs get a broken-link check; license/meta + data/config are skipped. Portable
// (no awk/python). exit 2 = block, 0 = allow. Warnings go to stderr with exit 0.

import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { payload } from './lib.mjs';

const MAX_SHOWN = 5;
const MAX_SQL = 3;
const FILE_HARD = 800;
const FILE_SOFT = 400;
const ALLOWED = new Set(['-1', '0', '1', '2']);
const NATIVE_LINTED = new Set(['rs', 'py', 'go', 'sh', 'bash', 'zsh']);
const DOC = new Set(['md', 'markdown', 'mdx', 'txt', 'rst', 'adoc']);
const DATA = new Set(['json', 'jsonl', 'yaml', 'yml', 'toml', 'xml', 'csv', 'ini', 'cfg']);
const MARKUP = new Set(['html', 'htm', 'xhtml', 'svg']); // markup, not logic — numbers in text/attrs aren't magic constants

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
  let i = 0;
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
      continue;
    }
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    if (c === '#') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    if (c === '-' && d === '-') { while (i < n && src[i] !== '\n') { blank(i); i++; } continue; }
    if (c === '/' && d === '*') {
      blank(i); blank(i + 1); i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { blank(i); i++; }
      if (i < n) { blank(i); blank(i + 1); i += 2; }
      continue;
    }
    i++;
  }
  return out.join('');
}

const p = await payload();
const file = (p.tool_input && p.tool_input.file_path) || '';
const content = (p.tool_input && (p.tool_input.content ?? p.tool_input.new_string)) || '';
if (!file) process.exit(0);

const norm = file.replace(/\\/g, '/');
if (/\/(node_modules|vendor|\.venv|venv|dist|build|target|\.git)\//.test(norm)) process.exit(0);
if (/(\.lock|\.sum)$|(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|uv\.lock)$/.test(norm)) {
  process.exit(0);
}
const base = basename(norm);
if (/^(LICENSE|COPYING|NOTICE|AUTHORS)(\..*)?$/.test(base)) process.exit(0);

const ext = base.includes('.') ? base.split('.').pop().toLowerCase() : '';

// DOC files: the check that actually rots docs — relative links with no target.
if (DOC.has(ext)) {
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
        '(Dead relative links rot the doc web — fix or correct the reference. Edit proceeds.)\n',
    );
  }
  process.exit(0);
}
if (DATA.has(ext) || MARKUP.has(ext)) process.exit(0); // config/data/markup is not logic-source

const isTest = /(\.test\.|\.spec\.|\/__tests__\/|\/tests?\/)/.test(norm);
const isMig = /\/(migrations|alembic\/versions)\//.test(norm);
const lines = content.split('\n');
const viols = [];
const warns = [];
const pick = (re) =>
  lines.map((l, i) => [i + 1, l]).filter(([, l]) => re.test(l)).slice(0, MAX_SHOWN);
const show = (hits) => hits.map(([n, l]) => `${n}: ${l.trim()}`).join('\n');

// 1. rot markers
const todo = pick(/\b(TODO|FIXME|XXX|HACK)\b/);
if (todo.length) viols.push('TODO/FIXME/XXX/HACK markers are not allowed in source:\n' + show(todo));

// 2. dead-code trace comments
const dead = pick(/^\s*(\/\/|#|--)\s*(removed|was:|deprecated:|old:|previously:)/i);
if (dead.length) viols.push('Dead-code trace comments (delete it; git is the record):\n' + show(dead));

// 3. magic numbers — skip native-linted langs, tests, migrations.
// Scan only EXECUTABLE CODE: numerics inside string/template literals, heredocs, and
// comments are prose, not constants (the KIT-T032 false positive — orient.mjs's prose
// heredoc carried "60-75k"/"70k"/"5-line"). `codeOnly` blanks every non-code span
// (keeping newlines so line numbers stay true) so the scan never sees those. The
// declaration/assignment skips below stay line-keyed against the ORIGINAL line.
if (!NATIVE_LINTED.has(ext) && !isTest && !isMig) {
  const codeLines = codeOnly(content).split('\n');
  const hits = [];
  for (let i = 0; i < lines.length && hits.length < MAX_SHOWN; i++) {
    const raw = lines[i];
    const code = codeLines[i] ?? '';
    if (!/\d/.test(code)) continue; // no numerics survived stripping → all prose/comment
    if (/\b(const|constexpr|let|var|final|#define|enum|static|readonly)\b/.test(raw)) continue; // declaration
    if (/^\s*[A-Za-z_]\w*\s*[:=][^=]/.test(raw)) continue; // name: / name=
    const stripped = code.replace(/\d+(px|em|rem)/g, '');
    const m = stripped.match(/[^A-Za-z0-9_.](-?\d+(\.\d+)?)/);
    if (m && !ALLOWED.has(m[1])) hits.push(`${i + 1}: ${raw.trim()}`);
  }
  if (hits.length) {
    viols.push('Magic numbers (allowed bare: -1, 0, 1, 2). Extract named constants:\n' + hits.join('\n'));
  }
}

// 4. SELECT *
const star = pick(/select\s+\*\s+from/i).slice(0, MAX_SQL);
if (star.length) viols.push('SELECT * detected (enumerate columns):\n' + show(star));

// 5. string-built SQL (warn — human review)
const sqlStr = pick(/(f"[^"]*\b(SELECT|INSERT|UPDATE|DELETE)\b|`[^`]*\$\{[^}]+\}[^`]*\b(SELECT|INSERT|UPDATE|DELETE)\b)/).slice(0, MAX_SQL);
if (sqlStr.length) warns.push('POSSIBLE string-built SQL (injection risk — parameterize/review):\n' + show(sqlStr));

// 6. file length
if (lines.length > FILE_HARD) viols.push(`File length ${lines.length} exceeds hard limit ${FILE_HARD} — split into cohesive modules.`);
else if (lines.length > FILE_SOFT) warns.push(`File length ${lines.length} exceeds soft limit ${FILE_SOFT} — consider splitting.`);

if (warns.length) {
  process.stderr.write(`WARN pre-write (${file}):\n` + warns.map((w) => '-- ' + w).join('\n\n') + '\n');
}
if (viols.length) {
  process.stderr.write(
    `\nBLOCKED: pre-write check failed for ${file}\n\n` +
      viols.map((v) => '-- ' + v).join('\n\n') +
      '\n\nFix before the write proceeds; if you believe it is a false positive, STOP and discuss.\n',
  );
  process.exit(2);
}
process.exit(0);
