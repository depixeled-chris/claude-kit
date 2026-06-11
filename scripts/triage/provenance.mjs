// triage/provenance.mjs — BACKWARD-provenance inference for triage (KIT-T065). Forward provenance
// (request → ticket → commit) is gate-enforced; the inverse (a bug → the change that CAUSED it) has
// always been pure judgment, so `regressed_from`/`causing_commit` were never once filled in. The kit
// already owns every primitive to answer it at intake; nothing asked. This does, for a bug/regression
// cap whose provenance fields are EMPTY:
//
//   1. FILES   — implicated files from the symptom/repro text, resolved against the repo's real file
//                set and WIDENED by code-graph importers (a regression in a file surfaces through its
//                dependents) — the KIT-T012 graph, not a grep.
//   2. GOVERNING — `q governing <files>` (the KIT-T049 file-scoped lookup, pointed at bug-intake
//                instead of edit time) → candidate `regressed_from` (the open ticket/decision that
//                governs the implicated file).
//   3. COMMITS — `git log` those files (since a last-known-good ref when given) + any SHA named in the
//                symptom → candidate `causing_commit`(s).
//
// The output is a PROPOSAL: top-N candidates, each carrying its EVIDENCE (the file, the governing item,
// the commit) so a wrong guess is auditable. The maintainer (or triage) accepts; an accepted link is
// written `provenance: inferred` (vs `given` for user-supplied) so it is never silently authoritative.
//
// FAIL-OPEN is absolute (the hook contract): a cold code-graph cache, a missing q result, no git
// history, or any thrown error degrades to "no candidates" — triage proceeds, never blocks. Nothing
// here throws to its caller.

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { query } from '../q.mjs';

const TOP_N = 3;              // candidates surfaced per cap — a hint list for the maintainer, not a dump
const GRAPH_TIMEOUT_MS = 20000; // code-graph builds the whole graph; bound it so a huge repo can't hang triage
const GIT_TIMEOUT_MS = 5000;   // per git invocation — fail-open to no commits rather than wedge
const LOG_PER_FILE = 3;        // most-recent commits pulled per implicated file (newest-first)
const MAX_SEED_FILES = 8;      // path tokens parsed from one symptom before we stop (a repro names a few)
const MAX_WIDENED_FILES = 12;  // seed + importer files we q/log against (bounds the fan-out cost)
const SHA_MIN = 7;             // shortest git short-sha we treat as a commit reference in prose
const SHA_MAX = 40;            // a full sha
const SHA_CUE_WINDOW = 24;     // chars scanned around a pure-digit hex run for a commit cue (merge/commit/…)
const SUBJECT_CLIP = 72;       // chars of a commit subject shown in evidence

// Bug-shaped types this inference applies to. A non-bug cap (a feature, a decision) has no "causing
// change" to find, so it is skipped — the resolver runs ONLY for these.
export const PROVENANCE_TYPES = new Set(['bug', 'regression']);

// The frontmatter provenance fields this fills. EMPTY across all of them is the precondition: a cap
// that already names a suspect (user-given provenance) is left alone — we never overwrite a human link.
const PROVENANCE_FIELDS = ['regressed_from', 'causing_commit', 'introduced_by'];

// A file-path token inside free prose: a slash-bearing path OR a bare source filename with a known
// code extension (chunkGround.ts, terrain.rs). Deliberately conservative — a stray "e.g." or "i.e."
// must not read as a path. The repo's real file set is the final authority (resolveFiles filters to it).
const CODE_EXT = 'ts|tsx|js|jsx|mjs|cjs|rs|py|go|java|c|h|cc|cpp|hpp|cs|rb|php|swift|kt|lua|vue|svelte';
const PATH_TOKEN_RE = new RegExp(
  `\\b([\\w.-]+(?:/[\\w.-]+)+\\.(?:${CODE_EXT})|[\\w-]+\\.(?:${CODE_EXT}))\\b`,
  'gi',
);
// A git short/long sha named in the symptom ("after the … merge (6712903)"). Hex, 7..40 long. Bounded
// by word edges so a longer hex-ish token isn't half-matched.
const SHA_RE = new RegExp(`\\b([0-9a-f]{${SHA_MIN},${SHA_MAX}})\\b`, 'gi');

// Parse the path-like tokens a symptom names, de-duped, capped. POSIX-normalized so a Windows-style
// mention lines up with the forward-slash paths the graph + stores use. Pure + total.
export function seedPaths(text) {
  const seen = new Set();
  for (const m of String(text || '').matchAll(PATH_TOKEN_RE)) {
    const p = m[1].replace(/\\/g, '/').replace(/^\.\//, '');
    if (!seen.has(p)) seen.add(p);
    if (seen.size >= MAX_SEED_FILES) break;
  }
  return [...seen];
}

// Candidate SHAs named in the symptom — explicit "caused by <sha>" evidence the maintainer already
// half-supplied in prose. Lower/normalized, de-duped. A token with an a-f letter is taken as a sha
// outright; a PURE-DIGIT hex run (e.g. `6712903`) is ambiguous with a plain number, so it is taken
// only when a commit CUE sits next to it — parenthesized, or adjacent to merge/commit/sha/PR. git
// verification downstream (resolveNamedSha) is the final gate, so a rare false positive is dropped
// there, never asserted. Pure + total.
const COMMIT_CUE_RE = /\b(?:merge|commit|sha|revision|rev|pr|pull request)\b/i;
export function namedShas(text) {
  const s = String(text || '');
  const seen = new Set();
  for (const m of s.matchAll(SHA_RE)) {
    const sha = m[1].toLowerCase();
    if (/[a-f]/.test(sha)) { seen.add(sha); continue; }
    const before = s.slice(Math.max(0, m.index - SHA_CUE_WINDOW), m.index);
    const paren = s[m.index - 1] === '(' || /[(,\s]$/.test(before);
    if (paren && COMMIT_CUE_RE.test(before + s.slice(m.index, m.index + sha.length + SHA_CUE_WINDOW))) seen.add(sha);
  }
  return [...seen];
}

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GIT_TIMEOUT_MS });
  } catch {
    return ''; // not a repo, git missing, timeout — fail-open to no output
  }
}

// The repo's real tracked file set (forward-slash), or null when `repoRoot` isn't a git repo / git is
// unavailable. Used to keep only symptom tokens that name an ACTUAL file (a repro often abbreviates a
// path; an exact suffix match against the real set repairs it).
function trackedFiles(repoRoot) {
  const out = git(['ls-files'], repoRoot);
  if (!out) return null;
  return out.split(/\r?\n/).filter(Boolean);
}

// Resolve each seed token to the repo file it names: an exact path, else the unique file whose path
// ENDS WITH the token (so `chunkGround.ts` resolves to `src/render/assets/ground/chunkGround.ts`). A
// token that matches zero or AMBIGUOUSLY many files is dropped — we never guess between two same-named
// files. Returns [] (not null) when the file set is unavailable, so the caller degrades to no candidates.
export function resolveFiles(seeds, files) {
  if (!files) return [];
  const set = new Set(files);
  const resolved = [];
  for (const s of seeds) {
    if (set.has(s)) { resolved.push(s); continue; }
    const suffixHits = files.filter((f) => f === s || f.endsWith('/' + s));
    if (suffixHits.length === 1) resolved.push(suffixHits[0]);
  }
  return [...new Set(resolved)];
}

// Widen the implicated set with code-graph IMPORTERS of each resolved file: a regression inside a file
// is observed through its dependents, so the file that broke AND the files that surface the break are
// both worth governing/logging. Heuristic + bounded; fail-open (a cold/failed graph just yields the
// seeds). Each `--query importers-of` shells the graph once per file (the graph rebuilds, but the
// repos this runs on are small and the call is bounded by GRAPH_TIMEOUT_MS).
function importersOf(repoRoot, file) {
  try {
    const out = execFileSync(
      'node', [graphScript(), repoRoot, '--query', 'importers-of', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: GRAPH_TIMEOUT_MS },
    );
    const arr = JSON.parse(out);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return []; // no graph / parse slip / timeout → no widening, never throw
  }
}

const graphScript = () => join(dirname(fileURLToPath(import.meta.url)), '..', 'code-graph.mjs');

function widenFiles(repoRoot, resolved) {
  const all = new Set(resolved);
  for (const f of resolved) {
    for (const imp of importersOf(repoRoot, f)) {
      all.add(imp);
      if (all.size >= MAX_WIDENED_FILES) return [...all];
    }
  }
  return [...all];
}

// `q governing <files>` against the TARGET repo's .ai store → the open tickets/decisions that govern
// the implicated files (candidate `regressed_from`). Async + fail-open: any error → []. Uses the q
// programmatic surface (scan-based for governing, so no cache dependency — KIT-T049).
async function governingItems(repoRoot, files) {
  if (!files.length) return [];
  try {
    const { rows } = await query('governing', files, { root: repoRoot, cwdRoot: repoRoot });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

// The most-recent commits that touched a file, newest-first, optionally bounded to AFTER a
// last-known-good ref (`sinceRef..HEAD`) so only suspect-window history is proposed. Each → {sha,
// subject, file}. Fail-open to [].
function commitsForFile(repoRoot, file, sinceRef) {
  const range = sinceRef ? [`${sinceRef}..HEAD`] : [];
  const out = git(
    ['log', `-n${LOG_PER_FILE}`, '--format=%h\t%s', ...range, '--', file],
    repoRoot,
  );
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean).map((line) => {
    const tab = line.indexOf('\t');
    const sha = (tab >= 0 ? line.slice(0, tab) : line).trim();
    const subject = tab >= 0 ? line.slice(tab + 1).trim() : '';
    return { sha, subject, file };
  });
}

// Resolve a SHA named in the symptom to {sha, subject} if it exists in the repo — so a prose-named
// "caused by 6712903" becomes verified evidence (and is dropped if the repo doesn't have it).
function resolveNamedSha(repoRoot, sha) {
  const out = git(['log', '-n1', '--format=%h\t%s', sha], repoRoot);
  if (!out) return null;
  const tab = out.indexOf('\t');
  return { sha: (tab >= 0 ? out.slice(0, tab) : out).trim(), subject: tab >= 0 ? out.slice(tab + 1).trim() : '' };
}

const clip = (s, n) => (String(s || '').length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ''));

// True when EVERY provenance field on a cap/item is empty — the precondition for inferring. A cap
// (id-less inbox file) carries none of these, so it is always eligible; an item that already names a
// suspect is skipped. `record` is anything with the parsed field keys (a cap row or a ticket row).
export function hasEmptyProvenance(record) {
  if (!record) return true;
  const camel = { regressed_from: 'regressedFrom', causing_commit: 'causingCommit', introduced_by: 'introducedBy' };
  for (const f of PROVENANCE_FIELDS) {
    if (record[f]) return false;
    if (record[camel[f]]) return false;
  }
  return true;
}

// THE resolver. Given a bug/regression's symptom text and the target repo, propose top-N backward-
// provenance candidates, each an EVIDENCE bundle: the implicated file, the governing item (candidate
// `regressed_from`), and the commit (candidate `causing_commit`). Returns a stable shape always —
// `{ candidates: [], evidence: {...} }` even on total failure — so triage can render "no candidates"
// without branching on errors. NEVER throws.
//
//   candidate = {
//     file,                       // the implicated file this candidate rests on
//     regressed_from | null,      // candidate governing-item id (the open ticket/decision)
//     governing | null,           // its evidence row { id, store, summary, matched }
//     causing_commit | null,      // candidate commit sha
//     commit | null,              // its evidence { sha, subject }
//     source: 'named-sha' | 'git-log',  // how the commit was found (a prose-named sha ranks first)
//   }
export async function inferProvenance(symptom, repoRoot, { sinceRef = null, topN = TOP_N } = {}) {
  const empty = { candidates: [], evidence: { seeds: [], files: [], governing: [], shas: [] } };
  try {
    const seeds = seedPaths(symptom);
    const shas = namedShas(symptom);
    const files = trackedFiles(repoRoot);
    const resolved = resolveFiles(seeds, files);
    const widened = widenFiles(repoRoot, resolved);

    const governing = await governingItems(repoRoot, widened);
    const govByFile = mapGovernanceToFiles(governing, widened);

    // Verified prose-named commits first (the maintainer half-supplied them), then git-log of the
    // implicated files. Each commit is paired with a governing item for the SAME file when one exists,
    // so a candidate carries all three evidence facets together.
    const candidates = [];
    for (const sha of shas) {
      const c = resolveNamedSha(repoRoot, sha);
      if (!c) continue;
      const gov = governing[0] || null; // a prose-named sha isn't file-scoped; pair the top governing hit
      candidates.push(candidate(resolved[0] || (widened[0] || null), gov, c, 'named-sha'));
    }
    for (const f of widened) {
      const gov = govByFile.get(f) || null;
      const commits = commitsForFile(repoRoot, f, sinceRef);
      if (!commits.length && gov) { candidates.push(candidate(f, gov, null, 'git-log')); continue; }
      for (const c of commits) candidates.push(candidate(f, gov, c, 'git-log'));
    }

    return {
      candidates: dedupRank(candidates).slice(0, topN),
      evidence: {
        seeds,
        files: widened,
        governing: governing.map((g) => ({ id: g.id, store: g.store, matched: g.matched })),
        shas,
      },
    };
  } catch {
    return empty; // absolute fail-open — a resolver crash must never block triage
  }
}

function candidate(file, gov, commit, source) {
  return {
    file: file || null,
    regressed_from: gov ? gov.id : null,
    governing: gov ? { id: gov.id, store: gov.store, summary: clip(gov.summary, SUBJECT_CLIP), matched: gov.matched } : null,
    causing_commit: commit ? commit.sha : null,
    commit: commit ? { sha: commit.sha, subject: clip(commit.subject, SUBJECT_CLIP) } : null,
    source,
  };
}

// Pair each governing item with the implicated file its pattern matched, so a candidate's commit (for
// file F) is annotated with the governing item that covers F — not some unrelated decision. A governing
// row's `matched` is the pattern that hit; map it back to the widened file it covers.
function mapGovernanceToFiles(governing, files) {
  const byFile = new Map();
  for (const g of governing) {
    for (const f of files) {
      if (byFile.has(f)) continue;
      if (patternCoversFile(g.matched, f)) byFile.set(f, g);
    }
  }
  return byFile;
}

// A loose containment test mirroring q's pathCovered, just enough to attribute a governing row's
// matched-pattern to one of the widened files (glob `*`, exact, or directory prefix). Total + cheap.
function patternCoversFile(matched, file) {
  const pats = String(matched || '').split(',').map((s) => s.replace(/^scope:/, '').trim()).filter(Boolean);
  const f = file.replace(/\\/g, '/');
  return pats.some((p) => {
    if (p.includes('*')) {
      const re = new RegExp('^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*'));
      return re.test(f);
    }
    return f === p || f.startsWith(p.replace(/\/$/, '') + '/') || f.includes(p);
  });
}

// Dedup identical (file, commit, governing) triples and rank: a candidate WITH a commit outranks one
// without; a named-sha commit outranks a git-log one; a candidate with a governing item outranks one
// without; then newest-found order is preserved. The maintainer reads the strongest evidence first.
function dedupRank(candidates) {
  const seen = new Set();
  const unique = [];
  for (const c of candidates) {
    const key = `${c.file}|${c.causing_commit}|${c.regressed_from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  const score = (c) => (c.causing_commit ? 2 : 0) + (c.source === 'named-sha' ? 1 : 0) + (c.regressed_from ? 1 : 0);
  return unique.sort((a, b) => score(b) - score(a));
}
