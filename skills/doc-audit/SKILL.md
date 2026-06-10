---
name: doc-audit
description: Audit a repo's docs against the actual code — broken links, stale references to renamed/deleted files or symbols, undocumented public surface, and out-of-date examples. Use after a refactor/rename, before a release, or when docs feel untrustworthy. Reports findings with pointers; you approve fixes.
model: sonnet
---

# Doc audit

Docs rot silently: a file moves, a flag is renamed, an API changes — and the prose
keeps describing the old world. This skill finds the drift between what's written and
what's true, and reports it for the maintainer to fix.

## What to check
1. **Broken links** — relative links/images in Markdown whose target no longer exists;
   anchors pointing at headings that were renamed. (The `pre-write` hook warns live on
   edited docs; this is the whole-repo sweep.)
2. **Stale code references** — doc mentions of `path/to/file`, function/class names,
   CLI flags, env vars, or config keys that no longer exist in the code. Grep each
   referenced symbol; flag the ones with zero hits.
3. **Out-of-date examples** — fenced code/command blocks that import removed modules,
   call changed signatures, or use flags the tool no longer accepts. Where cheap to
   verify, run the command/snippet.
4. **Undocumented surface** — public exports, commands, or config options with no doc
   mention. Flag the notable gaps (don't demand docs for every internal).
5. **Index/codemap drift** — a CODEMAP/README index that lists modules: do the listed
   paths exist, and do new modules appear?

## How to work
- Read-mostly: Glob the docs, Grep referenced symbols against the source, follow links.
- **Pointers, not payloads** — cite `doc:line → problem (the code says X)`.
- Separate certain breakage (link to a missing file) from likely-stale (a described
  behavior you can't fully verify); don't guess-fix prose you don't understand.

## Output
Findings grouped: **Broken (certain) / Stale (likely) / Gaps**. Each with the doc
`path:line`, the specific mismatch, and the corrected reference where you know it.
Propose edits; apply them only with the maintainer's go-ahead.
