#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — block GPL/LGPL/AGPL/unlicensed dependencies from
// entering a repo. exit 2 = block, 0 = allow. No-ops on unadopted repos. (KIT-T022)
//
// WHY: copyleft contamination of a private/commercial product is irreversible. A dep
// installed today under GPL taints the whole codebase; there's no un-contaminating it
// after the fact. This gate makes the wrong action impossible, not merely discouraged
// ("enforcement is hooks, not judgment").
//
// WHAT IT CHECKS:
//   npm install <pkg>[@ver] [flags]  — looks up the package's `license` field via
//   npm pack/view or the known-bad list. Fails OPEN if the lookup errors (offline /
//   private registry / unknown pkg) so the gate never blocks non-copyleft packages by
//   accident; only positive copyleft identification blocks.
//
//   cargo add <pkg>[@ver] [flags]    — same approach for Rust crates (crates.io API).
//
// BLOCKED licenses:  GPL-2.0, GPL-3.0, LGPL-2.0, LGPL-2.1, LGPL-3.0, AGPL-3.0
//                    and any variant containing "GPL" / "AGPL" / "copyleft" (case-ins).
// BLOCKED unknown:   when a package lookup explicitly returns "" / "UNLICENSED" /
//                    "SEE LICENSE IN …" AND the name isn't in an explicit allow list.
//
// ESCAPE: include [allow-license: <reason>] in the command, or set
//         CLAUDE_KIT_ALLOW_LICENSE=1. Both are deliberate, logged escapes.
//
// FAIL-OPEN: any parse / network / child-process error exits 0 — a broken guard must
// never wedge a shell command (HOOK CONTRACT).

import { execFileSync } from 'node:child_process';
import { payload, gitRoot, adopted, excludeFooter } from './lib.mjs';

// Spdx-id patterns that are definitively copyleft.
const COPYLEFT_RE = /GPL|AGPL|LGPL|EUPL|CDDL|OSL|MPL|SSPL|copyleft|CeCILL/i;
// Spdx ids we positively know are permissive — skip the registry lookup for speed.
const PERMISSIVE_RE = /^(MIT|Apache|BSD|ISC|Artistic|Zlib|Unlicense|CC0|WTFPL|0BSD|BlueOak)/i;
// Strings that signal "no license declared" — block unless escaped.
const UNLICENSED_RE = /^(UNLICENSED|UNLICENCED|SEE LICENSE|UNKNOWN|)$/i;

try {
  const p = await payload();
  const command = ((p.tool_input && p.tool_input.command) || '').trim();
  if (!command) process.exit(0);

  // Deliberate, logged escape — same shape as [allow-branch:] / [no-log:].
  if (/\[allow-license\b/i.test(command) ||
      /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_LICENSE || '')) {
    process.exit(0);
  }

  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  // Extract npm install / yarn add / pnpm add package specs.
  const npmPkgs = extractNpmPackages(command);
  // Extract cargo add package specs.
  const cargoPkgs = extractCargoPackages(command);

  if (!npmPkgs.length && !cargoPkgs.length) process.exit(0);

  const blocked = [];

  for (const pkg of npmPkgs) {
    const verdict = checkNpmLicense(pkg);
    if (verdict) blocked.push({ pkg, ...verdict });
  }

  for (const pkg of cargoPkgs) {
    const verdict = checkCargoLicense(pkg);
    if (verdict) blocked.push({ pkg, ...verdict });
  }

  if (blocked.length) {
    const lines = [
      '',
      'BLOCKED: copyleft or unlicensed dependency (KIT-T022).',
      '',
    ];
    for (const { pkg, license, reason } of blocked) {
      lines.push(`  ${pkg}  —  ${reason}${license ? ` (license: "${license}")` : ''}`);
    }
    lines.push(
      '',
      'Copyleft contamination of a private/commercial codebase is irreversible.',
      'Only permissive dependencies are allowed: MIT · Apache-2.0 · BSD · ISC · 0BSD.',
      '',
      'If this is a false positive or the use is genuinely legal (e.g. it is a',
      'devDependency that never ships, GPL tooling only used at build time, etc.),',
      'add a deliberate, logged escape:',
      '  • append [allow-license: <reason>] to the install command, or',
      '  • set CLAUDE_KIT_ALLOW_LICENSE=1.',
      '',
      'Then ADD an entry to THIRD_PARTY_LICENSES in the repo root explaining the',
      'license, the dep, and why it is acceptable.',
      '',
    );
    process.stderr.write(lines.join('\n') + excludeFooter('license-guard'));
    process.exit(2);
  }

  // All packages checked and permissive — allow, but nudge about the ledger.
  if (npmPkgs.length || cargoPkgs.length) {
    const all = [...npmPkgs, ...cargoPkgs];
    process.stderr.write(
      `\nINFO (license-guard): ${all.join(', ')} — license OK.\n` +
      `  Remember to add an entry to THIRD_PARTY_LICENSES if this is a new dep.\n\n`,
    );
  }

  process.exit(0);
} catch {
  process.exit(0); // fail-open per HOOK CONTRACT
}

// ---------------------------------------------------------------------------
// Package extraction
// ---------------------------------------------------------------------------

// Extract package names from: npm install / yarn add / pnpm add / npm i
// Returns bare package names (no @version, no flags).
function extractNpmPackages(command) {
  const pkgs = [];
  // Match each npm/yarn/pnpm invocation segment (chains are split by &&/;)
  const segs = command.split(/&&|;/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segs) {
    const m = seg.match(/\bnpm\s+(?:install|i|add)\b|\byarn\s+add\b|\bpnpm\s+add\b/);
    if (!m) continue;
    // Tokenize after the subcommand verb.
    const rest = seg.slice(m.index + m[0].length).trim();
    const toks = tokenize(rest);
    for (const tok of toks) {
      if (tok.startsWith('-')) continue; // flag
      if (tok.startsWith('.') || tok.startsWith('/') || tok.includes('://')) continue; // local/url
      // Strip @version suffix (but keep scoped-package @scope prefix).
      const name = stripVersion(tok);
      if (name) pkgs.push(name);
    }
  }
  return pkgs;
}

// Extract package names from: cargo add <crate>[@ver]
function extractCargoPackages(command) {
  const pkgs = [];
  const segs = command.split(/&&|;/).map((s) => s.trim()).filter(Boolean);
  for (const seg of segs) {
    if (!/\bcargo\s+add\b/.test(seg)) continue;
    const m = seg.match(/\bcargo\s+add\b/);
    const rest = seg.slice(m.index + m[0].length).trim();
    const toks = tokenize(rest);
    for (const tok of toks) {
      if (tok.startsWith('-')) continue;
      const name = stripVersion(tok);
      if (name) pkgs.push(name);
    }
  }
  return pkgs;
}

// Minimal shell tokenizer: splits on whitespace, handles "quoted" and 'quoted' spans.
function tokenize(s) {
  const toks = [];
  let cur = '';
  let q = '';
  for (const ch of s) {
    if (q) { if (ch === q) q = ''; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (/\s/.test(ch)) { if (cur) { toks.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) toks.push(cur);
  return toks;
}

// Strip @version from foo@1.2.3; keep @scope/pkg intact.
// @scope/pkg@1.2.3 → @scope/pkg
function stripVersion(tok) {
  if (tok.startsWith('@')) {
    // scoped: @scope/pkg or @scope/pkg@ver
    const m = tok.match(/^(@[^/]+\/[^@]+)/);
    return m ? m[1] : '';
  }
  return tok.split('@')[0] || '';
}

// ---------------------------------------------------------------------------
// License lookup — npm
// ---------------------------------------------------------------------------

function checkNpmLicense(pkg) {
  try {
    // `npm view <pkg> license` — fast, no install, no download. Fails open if
    // the package doesn't exist or the registry is unreachable.
    const raw = execFileSync('npm', ['view', pkg, 'license', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).trim();
    // npm --json returns a quoted string or null.
    let license = '';
    try { license = JSON.parse(raw) || ''; } catch { license = raw.replace(/^"|"$/g, ''); }
    license = String(license || '').trim();

    if (PERMISSIVE_RE.test(license)) return null; // explicitly permissive — allow
    if (COPYLEFT_RE.test(license)) return { license, reason: 'copyleft license' };
    if (UNLICENSED_RE.test(license)) return { license, reason: 'no license declared (unlicensed)' };
    // Unknown license string — flag it.
    return { license, reason: 'unrecognised license — verify it is permissive before adding' };
  } catch {
    // Fail-open: lookup error (offline, private, 404) — don't block.
    return null;
  }
}

// ---------------------------------------------------------------------------
// License lookup — cargo/crates.io
// ---------------------------------------------------------------------------

function checkCargoLicense(pkg) {
  try {
    // crates.io has a JSON API; curl/wget may not be available — fall back to
    // `cargo search` which outputs license info. But `cargo search` output is
    // not easily machine-readable. Use the HTTP API if possible; fail-open otherwise.
    const bare = pkg.split('@')[0]; // strip any @version prefix already
    const url = `https://crates.io/api/v1/crates/${encodeURIComponent(bare)}`;
    const out = execFileSync('node', ['-e',
      `const h=require('https');` +
      `h.get('${url}',{headers:{'User-Agent':'claude-kit-license-guard/1.0'}},r=>{` +
      `let d='';r.on('data',c=>d+=c);r.on('end',()=>{` +
      `try{const j=JSON.parse(d);process.stdout.write(j.crate&&j.crate.license||'');}` +
      `catch{process.stdout.write('');}});}).on('error',()=>process.stdout.write(''));`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).trim();
    if (!out) return null; // fail-open: empty = unknown, don't block
    if (PERMISSIVE_RE.test(out)) return null;
    if (COPYLEFT_RE.test(out)) return { license: out, reason: 'copyleft license' };
    if (UNLICENSED_RE.test(out)) return { license: out, reason: 'no license declared (unlicensed)' };
    return { license: out, reason: 'unrecognised license — verify it is permissive before adding' };
  } catch {
    return null; // fail-open
  }
}
