---
name: release-checklist
description: Run a disciplined pre-push / pre-release verification before publishing a change — tests, build, debug-leftover scan, version/changelog, and commit hygiene. Use before opening a PR, pushing to main, or cutting a release. Reports a go/no-go with the evidence; fixes nothing on its own.
---

# Release checklist

A repeatable gate between "local draft" and "published." Local commits can be messy;
what leaves the machine must be clean, logical, and buildable. Run this, report each
item's result with the command output, and give a clear **GO / NO-GO** — never a
vibe-based "looks good."

## Steps (adapt to the project's actual tooling)

1. **Clean tree & scope** — `git status` is clean or intentional; the diff
   (`git diff origin/<base>...`) contains only what this change should contain. No
   stray files, no unrelated edits.
2. **Tests** — run the full suite. Green is required; quote the summary line. A
   skipped/quarantined test is called out, not ignored.
3. **Build / typecheck / lint** — run them. They must pass. Treat warnings as
   findings, not noise.
4. **Debug leftovers** — scan the diff for `console.log`/`print`/`dbg!`, commented-out
   code, `TODO`/`FIXME` added by this change, secrets/keys, and `.only`/`fdescribe`
   focused tests. Flag every hit with `path:line`.
5. **Version & changelog** — if the project versions releases, bump per its scheme and
   update the changelog/release notes. If it doesn't, skip and say so.
6. **Commit hygiene** — messages are meaningful and tied to the work item; squash/clean
   noise before pushing (`git rebase -i origin/<base>`). Respect the project's hook
   gate — never `--no-verify`.
7. **Docs** — public-facing behavior changed? The README/docs/CLAUDE.md reflect it.
8. **Doc audit** — run `/doc-audit` over the named docs (README, CLAUDE.md,
   `skills/claude-kit/SKILL.md`, `docs/DAILY-LOOP.md`, `skills/README.md`,
   `agents/README.md`). Check: (a) broken relative links (target exists?), (b) stale
   code refs — grep each mentioned path/command/flag; flag zero-hit ones, (c) command
   and script counts match `ls commands/` and `ls scripts/*.mjs`. The audit must come
   back CLEAN before GO.

## Output
A checklist with ✓/✗/skip per item, the command + result for each ✗, and a one-line
**GO** or **NO-GO**. On NO-GO, list exactly what must change first. Don't fix things
silently — surface them so the author decides.
