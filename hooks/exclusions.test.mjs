// Automated test for the unified exclusion system (KIT-T051). Asserts that a
// magic-numbers violation in pre-write.mjs IS suppressed by (a) a .claude-kit-ignore.yaml
// path glob and (b) an in-source start/end block marker; is NOT suppressed elsewhere; and
// that an un-excluded check still HALTS (exit 2). Also covers the lib helpers directly.
// Run: node hooks/exclusions.test.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  loadIgnoreConfig,
  pathExcluded,
  markerExcludedLines,
  excludeFooter,
} from './lib.mjs';

const HOOK = fileURLToPath(new URL('./pre-write.mjs', import.meta.url));
const fixtures = [];
let failures = 0;

function expect(name, actual, wanted) {
  const ok = actual === wanted;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (got=${JSON.stringify(actual)}, want=${JSON.stringify(wanted)})`);
  if (!ok) failures++;
}

// A throwaway adopted repo (.git marks the project root for projectRoot()).
function makeRepo(ignoreYaml) {
  const d = mkdtempSync(join(tmpdir(), 'kit-excl-'));
  fixtures.push(d);
  mkdirSync(join(d, '.git'), { recursive: true });
  mkdirSync(join(d, 'src', 'gen'), { recursive: true });
  mkdirSync(join(d, 'src', 'other'), { recursive: true });
  if (ignoreYaml != null) writeFileSync(join(d, '.claude-kit-ignore.yaml'), ignoreYaml);
  return d;
}

// Run pre-write against a synthetic file payload; return the exit code.
function runPreWrite(root, relPath, content) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd: root,
    input: JSON.stringify({ tool_input: { file_path: join(root, relPath), content } }),
    encoding: 'utf8',
  });
  return r.status;
}

// A bare magic constant on a non-declaration line — the canonical violation.
const OFFENDING = 'function f(x) {\n  return x * 1337;\n}\n';

try {
  // --- 1. un-excluded check still HALTS ---------------------------------------
  const plain = makeRepo(null);
  expect('un-excluded magic number halts (exit 2)', runPreWrite(plain, 'src/other/a.ts', OFFENDING), 2);

  // --- 2. suppressed by a .claude-kit-ignore.yaml path glob -------------------
  const globbed = makeRepo('magic-numbers:\n  - src/gen/**\n');
  expect('yaml glob suppresses under the path', runPreWrite(globbed, 'src/gen/a.ts', OFFENDING), 0);
  expect('yaml glob does NOT suppress elsewhere', runPreWrite(globbed, 'src/other/a.ts', OFFENDING), 2);

  // --- 3. suppressed by an in-source start/end block marker -------------------
  const marked = makeRepo(null);
  const blockMarked =
    'function f(x) {\n' +
    '  // claude-kit-ignore-start magic-numbers\n' +
    '  return x * 1337;\n' +
    '  // claude-kit-ignore-end\n' +
    '}\n';
  expect('in-source block marker suppresses', runPreWrite(marked, 'src/other/b.ts', blockMarked), 0);

  // a marker for a DIFFERENT check-id must NOT suppress magic-numbers
  const wrongId =
    'function f(x) {\n' +
    '  return x * 1337; // claude-kit-ignore file-length\n' +
    '}\n';
  expect('marker for another id does not suppress', runPreWrite(marked, 'src/other/c.ts', wrongId), 2);

  // catch-all 'all' marker DOES suppress
  const allMarked =
    'function f(x) {\n' +
    '  return x * 1337; // claude-kit-ignore all\n' +
    '}\n';
  expect("trailing 'all' marker suppresses", runPreWrite(marked, 'src/other/d.ts', allMarked), 0);

  // --- 4. lib helpers directly ------------------------------------------------
  const cfgRepo = makeRepo('magic-numbers:\n  - "src/**/geometry/**"\n"*":\n  - vendor/**\n');
  const cfg = loadIgnoreConfig(cfgRepo);
  expect('loadIgnoreConfig parses the check key', Array.isArray(cfg['magic-numbers']), true);
  expect('loadIgnoreConfig parses the catch-all key', Array.isArray(cfg['*']), true);
  expect('pathExcluded matches ** glob', pathExcluded(cfgRepo, 'magic-numbers', join(cfgRepo, 'src', 'a', 'geometry', 'b.ts')), true);
  expect('pathExcluded rejects a non-match', pathExcluded(cfgRepo, 'magic-numbers', join(cfgRepo, 'src', 'a', 'b.ts')), false);
  expect("catch-all '*' applies to any check", pathExcluded(cfgRepo, 'file-length', join(cfgRepo, 'vendor', 'x.ts')), true);
  expect('missing config is empty (fail-open)', Object.keys(loadIgnoreConfig(makeRepo(null))).length, 0);

  const src = 'a\n# claude-kit-ignore-start magic-numbers\nb\nc\n# claude-kit-ignore-end\nd\n';
  const m = markerExcludedLines(src, 'magic-numbers');
  expect('markerExcludedLines: block lines are 3 and 4', [...m.lines].sort((x, y) => x - y).join(','), '3,4');
  expect('markerExcludedLines: not whole-file', m.wholeFile, false);
  const wholeFile = markerExcludedLines('-- claude-kit-ignore-file all\nx\n', 'magic-numbers');
  expect('markerExcludedLines: -- file marker → whole file', wholeFile.wholeFile, true);

  const footer = excludeFooter('magic-numbers');
  expect('excludeFooter names the check-id', footer.includes('id: magic-numbers'), true);
  expect('excludeFooter shows the yaml surface', footer.includes('.claude-kit-ignore.yaml'), true);
  expect('excludeFooter shows the marker surface', footer.includes('claude-kit-ignore-start magic-numbers'), true);
} finally {
  for (const d of fixtures) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log(failures ? `\n${failures} FAIL` : '\nall pass');
process.exit(failures ? 1 : 0);
