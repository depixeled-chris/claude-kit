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

## The hooks (target set — being ported from the prior bash versions)
| Event | Hook | Does |
| --- | --- | --- |
| `SessionStart` | orient | Inject the on-disk record (`.ai/` ROADMAP + DECISIONS + SESSION + recent commits) so a fresh/compacted session resumes cold. |
| `PreToolUse` (Edit\|Write) | code/doc checks | Code-quality gates on source; **doc files** get a broken-link check instead of magic-number/etc; license/meta + data files skip. |
| `PreToolUse` (Bash) | work-log gate | Block a `git commit` of code not tied to a ticket / plan-of-record (override `[no-log: reason]`). |
| `PreCompact` + `Stop` | flush | Force a `.ai/SESSION.md` flush before context is lost. |

## Rules
- **Opt-in-aware:** first thing each hook does is `exit 0` unless `.ai/` (or a
  project ROADMAP) is present. Global install must never punish unadopted repos.
- **Fail-open on parse errors** — a malformed payload must not wedge the session.
- **Least surprise:** block only on hard violations; warn (stderr, exit 0) otherwise.
- Wired into `~/.claude/settings.json` via `user-config/settings.recommended.json`;
  installed/symlinked by `bootstrap.sh`.

> Status: ports in progress (see `.ai/INBOX.md`). The verified bash prototypes live
> on the authoring machine and are being moved here as Node.
