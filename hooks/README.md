# Hooks library

Portable **Node** enforcement hooks — the layer that makes the workflow
non-skippable, installed globally by `bootstrap.sh` but **opt-in-aware** (each
exits immediately unless the repo has `.ai/`, so they never interfere with
unadopted projects).

## Why Node, not bash
OS-shell hook scripts aren't portable and broke in practice (Windows/MSYS +
Python path handling, and a `python - <<heredoc` bug that ate its own stdin and
silently disabled a check). Node runs the same on every machine. Each hook reads
the tool payload from stdin, decides, and exits (`exit 2` = block, `0` = allow).

## The hooks
| Event | Hook | Does |
| --- | --- | --- |
| `SessionStart` | orient + housekeeping | Inject the on-disk record (`.ai/` ROADMAP + DECISIONS + SESSION + recent commits) so a fresh/compacted session resumes cold; surface any due weekly reviews + project gaps. |
| `PreToolUse` (Edit\|Write) | pre-write | Code-quality gates on source; **doc files** get a broken-link check instead of magic-number/etc; license/meta + data files skip. |
| `PostToolUse` (Edit\|Write) | lint + jscpd | Language-aware linters (ruff/clippy/eslint/…) + copy-paste detection. Advisory — never block; warn and log tooling gaps. |
| `PreToolUse` (Bash) | commit-gate | Block a `git commit` of code not tied to a ticket / plan-of-record (override `[no-log: reason]`). |
| `PreCompact` | flush | Force a `.ai/SESSION.md` flush before context is lost. |
| `Stop` | housekeeping | Nag at end-of-turn if a weekly review is overdue. |

**Tool resolution (`lib.nodeCli`)** runs node-ecosystem linters as `node <bin.js>` —
resolving project-local first, then a global install — so a `.cmd`-shimmed global on
Windows (which `execFileSync` can't spawn) works without ever invoking a shell.
`lint`/`jscpd` are advisory and intentionally **not** gated on `.ai/` (they run in any
repo, like `pre-write`); only the enforcement hooks no-op on unadopted repos.

## Rules
- **Opt-in-aware:** first thing each hook does is `exit 0` unless `.ai/` (or a
  project ROADMAP) is present. Global install must never punish unadopted repos.
- **Fail-open on parse errors** — a malformed payload must not wedge the session.
- **Least surprise:** block only on hard violations; warn (stderr, exit 0) otherwise.
- Wired into `~/.claude/settings.json` via `user-config/settings.recommended.json`;
  installed/symlinked by `bootstrap.sh`.

> Status: **fully ported to Node** — `lib`, `orient`, `commit-gate`, `flush`, `pre-write`,
> `lint`, `jscpd`, `housekeeping`. The hooks layer is Node-only; no bash hooks remain.
> Wired via `user-config/settings.recommended.json` + `bootstrap.sh`. Verified against
> mock payloads; the port fixes the bash bugs (const-skip, Windows backslash paths, the
> `python - <<heredoc` stdin bug that silently disabled lint/jscpd, and a gap-dedup key
> that never matched).
