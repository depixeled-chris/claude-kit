#!/usr/bin/env node
// PostToolUse (Write|Edit) — copy-paste detector (jscpd) over the edited file's
// directory; cross-language DRY enforcer. Never blocks; warns on duplication
// above threshold and records the gap. Node port of the bash version, which
// silently no-opped (its `python - <<heredoc` ate the payload off stdin) and
// whose gap-dedup key never matched the log format.

import { existsSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { payload, VENDORED, nodeCli, runStatus, logGap, projectRoot, pathExcluded, excludeFooter } from './lib.mjs';

const THRESHOLD_PCT = 5;
const MIN_LINES = 8;
const MIN_TOKENS = 50;
const TAIL = 30;
const SKIP_EXT = new Set(['lock', 'sum', 'json', 'md', 'yaml', 'yml', 'xml', 'csv', 'txt']);

const p = await payload();
const file = (p.tool_input && p.tool_input.file_path) || '';
if (!file || !existsSync(file)) process.exit(0);

const norm = file.replace(/\\/g, '/');
if (VENDORED.test(norm)) process.exit(0);
const ext = basename(norm).includes('.') ? basename(norm).split('.').pop().toLowerCase() : '';
if (SKIP_EXT.has(ext)) process.exit(0);

const dir = dirname(file);
// KIT-T051: a path glob under `duplication` (or '*') exempts this file from the DRY warn.
if (pathExcluded(projectRoot(dir), 'duplication', file)) process.exit(0);
const bin = nodeCli('jscpd', dir);
if (!bin) {
  logGap('missing-tool', file, 'jscpd not installed (install: npm install -g jscpd)');
  process.exit(0);
}

const { code, out } = runStatus(
  process.execPath,
  [
    bin,
    '--silent',
    '--threshold', String(THRESHOLD_PCT),
    '--min-lines', String(MIN_LINES),
    '--min-tokens', String(MIN_TOKENS),
    '--reporters', 'consoleFull',
    '--ignore', '**/node_modules/**,**/dist/**,**/build/**,**/target/**,**/.venv/**,**/vendor/**',
    dir,
  ],
  dir,
);

// jscpd exits non-zero when duplication exceeds --threshold. Require a genuine
// report in the output too, so a spawn failure (empty output) never false-warns.
if (code !== 0 && /duplicated lines/i.test(out)) {
  process.stderr.write(
    `WARN [jscpd] duplication detected in ${dir}:\n` +
      out.split('\n').filter(Boolean).slice(-TAIL).map((l) => '  ' + l).join('\n') +
      '\n' +
      excludeFooter('duplication'),
  );
  logGap('duplication-warned', dir, 'jscpd flagged duplication above threshold');
}
process.exit(0);
