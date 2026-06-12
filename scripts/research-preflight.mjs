#!/usr/bin/env node
// research-preflight.mjs — scan docs/research/ for an existing canonical doc before
// commissioning a researcher/design-doc agent. Advisory only: exit 0 either way.
//
// WHY this exists: a researcher agent was commissioned for "buildings" without first
// checking docs/research/ — enterable-buildings.md already existed → duplicate doc +
// reconciliation cost (KIT-T047). This preflight surfaces prior art so the agent can
// EXTEND the canonical doc instead of authoring a parallel one.
//
// Usage:
//   node scripts/research-preflight.mjs <topic...>
//   node scripts/research-preflight.mjs --root /path/to/repo <topic...>
//
// Match strategy: topic terms are matched against each doc's:
//   1. Filename (stem, split on [-_])
//   2. H1 heading (first # line)
//   3. Frontmatter `title:` and `description:` fields
// Results are ranked by match count (descending). Fail-open on any error.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { execFileSync } from 'node:child_process';

// ---------- arg parsing ----------

const args = process.argv.slice(2);
let repoRoot = null;
const topicTerms = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root') {
    repoRoot = args[++i];
  } else {
    topicTerms.push(args[i].toLowerCase());
  }
}

if (topicTerms.length === 0) {
  console.error('Usage: research-preflight.mjs [--root <dir>] <topic...>');
  process.exit(1);
}

// If no explicit root, walk up from cwd to find the git root.
// Fail-open: if git isn't available or we're not in a repo, use cwd.
if (!repoRoot) {
  try {
    repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // Not a git repo or git unavailable — use cwd.
    repoRoot = process.cwd();
  }
}

const RESEARCH_DIR = join(repoRoot, 'docs', 'research');

// ---------- constants ----------

// Minimum number of topic terms that must match for a doc to be considered a candidate.
// A value of 1 is intentionally permissive — the user reviews the ranked list and decides.
const MIN_MATCH_COUNT = 1;

// Frontmatter fields to inspect for topic terms.
const FRONTMATTER_FIELDS = ['title', 'description'];

// ---------- scanning ----------

/**
 * Extract searchable text tokens from a markdown file's frontmatter, H1, and filename.
 * Returns { filename, h1, frontmatterFields, stem } — raw strings, lowercased.
 */
function extractDocMeta(filePath) {
  const stem = basename(filePath, '.md').toLowerCase().replace(/[-_]/g, ' ');
  let h1 = '';
  const frontmatterFields = {};

  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    // Unreadable file — fail-open, return only stem.
    return { stem, h1, frontmatterFields };
  }

  // Parse YAML frontmatter between leading --- delimiters.
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const fmBlock = fmMatch[1];
    for (const field of FRONTMATTER_FIELDS) {
      // Match `field: value` or `field: "value"` or `field: 'value'`
      const re = new RegExp(`^${field}:\\s*['"']?(.+?)['"']?\\s*$`, 'm');
      const m = fmBlock.match(re);
      if (m) frontmatterFields[field] = m[1].toLowerCase();
    }
  }

  // First H1 heading (# Title).
  const h1Match = content.match(/^#\s+(.+)/m);
  if (h1Match) h1 = h1Match[1].toLowerCase();

  return { stem, h1, frontmatterFields };
}

/**
 * Count how many topic terms appear in any of the doc's searchable text.
 * Each term is checked once against the union of all text; duplicates don't double-score.
 */
function matchScore(meta, terms) {
  // Build a single concatenated string from all searchable text.
  const haystack = [
    meta.stem,
    meta.h1,
    ...Object.values(meta.frontmatterFields),
  ].join(' ');

  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score++;
  }
  return score;
}

// ---------- main ----------

// Fail-open: if the docs/research dir doesn't exist, that's fine — no prior art.
if (!existsSync(RESEARCH_DIR)) {
  console.log('no prior art found — OK to author fresh (docs/research/ not present)');
  process.exit(0);
}

let files;
try {
  files = readdirSync(RESEARCH_DIR).filter(f => f.endsWith('.md'));
} catch {
  console.log('no prior art found — OK to author fresh (could not read docs/research/)');
  process.exit(0);
}

// Score each doc against the topic terms.
const candidates = [];
for (const file of files) {
  const filePath = join(RESEARCH_DIR, file);
  const meta = extractDocMeta(filePath);
  const score = matchScore(meta, topicTerms);
  if (score >= MIN_MATCH_COUNT) {
    candidates.push({ file, filePath, meta, score });
  }
}

// Rank by score descending.
candidates.sort((a, b) => b.score - a.score);

if (candidates.length === 0) {
  console.log('no prior art found — OK to author fresh');
  process.exit(0);
}

console.log(`found ${candidates.length} candidate canonical doc(s) — EXTEND, do not duplicate:\n`);
for (const c of candidates) {
  // Show the display title: prefer frontmatter title, then H1, then stem.
  const displayTitle =
    c.meta.frontmatterFields.title ||
    c.meta.h1 ||
    c.meta.stem;
  const matchWord = c.score === topicTerms.length ? 'full match' : `${c.score}/${topicTerms.length} terms`;
  console.log(`  ${c.filePath}  [${matchWord}]`);
  console.log(`  title: ${displayTitle}`);
  console.log();
}
process.exit(0);
