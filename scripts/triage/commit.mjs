// triage/commit.mjs — commit triage --apply's OWN markdown output (KIT-T045). apply writes new
// item files, folds/supersede edits, and moves processed caps into inbox/triaged/. The separate
// Stop-hook "sync: workflow data" auto-commits the raw caps, but apply's own edits would otherwise
// sit untracked until a later sync — losing the descriptive message and leaving a tracked-result
// gap. So apply commits exactly what it touched, with a message naming the promotion.
//
// Fail-open: triage already succeeded by the time we get here. A commit hiccup (no git, detached
// state, hook rejection, nothing staged) must NEVER fail the apply — warn and return. The .ai
// stores can live in a DIFFERENT repo than the project (the claude-kit-data junction), so the
// commit lands in whichever working tree the touched files actually resolve into — exactly how
// sync-data.mjs resolves the data repo through the .ai junction.

import { existsSync, realpathSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { git } from '../../hooks/lib.mjs';

// The git working tree a file belongs to (a junction/symlink resolves into the data repo, not the
// project repo). `git -C` needs a DIRECTORY, so anchor on the file's parent (mirrors sync-data.mjs,
// which runs `-C` against the resolved .ai dir). Empty string when the file is in no repo or git is
// unavailable — caller skips it. Used only as a grouping/dedup KEY (not for path math), so the
// 8.3-vs-long-form realpath mismatch on Windows can't corrupt a pathspec — git resolves each
// add/commit relative to the file's own directory, never to this key.
function workTreeOf(fileDir) {
  return git(['-C', fileDir, 'rev-parse', '--show-toplevel']).trim();
}

// Resolve a store-relative path under a scope's aiDir to an absolute, realpath'd path. Returns null
// when the file no longer exists (e.g. a fold target that vanished) so it's skipped, not staged.
function abs(aiDir, rel) {
  const p = join(aiDir, rel);
  if (!existsSync(p)) return null;
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

// Collect every absolute path apply touched, grouped by the git working tree it lives in. Each
// receipt contributes: the written/edited item (`dest`, a store-relative path for
// create/fold/supersede), the moved cap's NEW location (`movedTo`), and the cap's ORIGINAL
// location (`capFile`) so the rename's deletion side is staged too. skip/error receipts (dest is
// 'skipped' / a diagnostic, not a path) contribute nothing. A deleted file (the moved-away cap)
// has no realpath, so its directory + basename are tracked literally.
function pathsByTree(applied, aiDirByScope) {
  const trees = new Map(); // toplevel key -> [{ dir, name }] (stage from `dir`, by basename)
  const add = (aiDir, rel, mustExist = true) => {
    if (!rel) return;
    const literal = join(aiDir, rel);
    const a = mustExist ? abs(aiDir, rel) : literal; // existing files resolve through the junction
    if (mustExist && !a) return;
    const dir = dirname(a);
    const name = basename(a);
    const top = workTreeOf(dir);
    if (!top) return;
    if (!trees.has(top)) trees.set(top, []);
    const list = trees.get(top);
    if (!list.some((e) => e.dir === dir && e.name === name)) list.push({ dir, name });
  };
  for (const r of applied) {
    const aiDir = aiDirByScope.get(r.scope);
    if (!aiDir) continue;
    if (r.dest && r.dest.includes('/')) add(aiDir, r.dest); // a store-relative path, not a diagnostic
    add(aiDir, r.movedTo);
    add(aiDir, r.capFile, false); // original cap path is GONE (renamed) — stage its deletion
  }
  return trees;
}

function summarize(applied) {
  const n = applied.filter((r) => r.movedTo).length; // caps actually promoted (moved out of inbox)
  const scopes = [...new Set(applied.map((r) => r.scope))].filter((s) => s && s !== '?').sort();
  const cross = scopes.length > 1 ? ' [cross-project]' : scopes.length === 1 ? ` [${scopes[0]}]` : '';
  return `triage: promote ${n} cap${n === 1 ? '' : 's'} -> tickets/decisions/notes${cross}`;
}

// Stage EXACTLY the touched paths in each working tree and commit them with a descriptive message.
// Precise on purpose: git add of specific pathspecs (never `add -A`) so unrelated dirty files in
// the data repo are left for the Stop-hook sync to handle. Returns the receipts so callers can log.
export function commitApply({ applied, aiDirByScope }) {
  const committed = [];
  let trees;
  try {
    trees = pathsByTree(applied, aiDirByScope);
  } catch (e) {
    process.stderr.write(`[triage] commit skipped (could not resolve paths): ${e && e.message ? e.message : e}\n`);
    return committed;
  }
  if (!trees.size) return committed;
  const msg = summarize(applied);
  for (const [top, entries] of trees) {
    try {
      // Stage each file from its OWN directory (git resolves the basename against `-C <dir>`), so
      // no manual repo-relative path math — robust to Windows 8.3 short-name realpath mismatches.
      for (const { dir, name } of entries) git(['-C', dir, 'add', '--', name]);
      const anchor = entries[0].dir; // any touched dir is inside the tree → a valid `-C` anchor
      // Nothing actually staged (e.g. paths already committed by a prior sync) → no-op cleanly.
      if (!git(['-C', anchor, 'diff', '--cached', '--name-only']).trim()) continue;
      git(['-C', anchor, 'commit', '-m', msg]);
      committed.push({ tree: top, count: entries.length, message: msg });
    } catch (e) {
      process.stderr.write(`[triage] commit in ${top} skipped: ${e && e.message ? e.message : e}\n`);
    }
  }
  if (committed.length) {
    process.stderr.write(`[triage] committed ${committed.length === 1 ? 'output' : `output in ${committed.length} repos`}: ${msg}\n`);
  }
  return committed;
}
