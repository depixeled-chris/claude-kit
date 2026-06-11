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
| `SessionStart` | orient + housekeeping | Inject the on-disk record (`.ai/` ROADMAP + DECISIONS + SESSION + recent commits + **in-flight delegated agents**) so a fresh/compacted session resumes cold; surface any due weekly reviews + project gaps. |
| `PreToolUse` (Edit\|Write) | pre-write | Code-quality gates on source; **doc files** get a broken-link check instead of magic-number/etc; license/meta + data files skip. |
| `PostToolUse` (Edit\|Write) | lint + jscpd + ingest-data | Language-aware linters (ruff/clippy/eslint/…) + copy-paste detection (advisory — never block). **ingest-data** incrementally syncs the SQLite cache for the edited `.ai` store immediately, so a same-turn query sees the change (KIT-T026; fail-open). |
| `PostToolUse` (Task) + `SubagentStop` | agent-roster | Append each delegated subagent (task, scope, handle, status) to the durable roster `.ai/agents.jsonl`, and mark its completion — so a `/clear` mid-delegation never orphans the work; orient replays it on resume (KIT-T014; fail-open, never blocks a delegation). |
| `PreToolUse` (Bash) | commit-gate | Block a `git commit` of code not tied to a ticket / plan-of-record (override `[no-log: reason]`). |
| `PreToolUse` (AskUserQuestion) | question-gate | Block a non-compliant questionnaire (KIT-T086): every question must mark its recommended option on the LABEL (prefix `(Recommended)`), and — single-select — list it FIRST. Catches the lived bug of putting the marker in the option DESCRIPTION (where it never renders). Agent-discipline rule — fires regardless of `.ai/` adoption; fail-open. |
| `PreCompact` | flush | Force a `.ai/SESSION.md` flush before context is lost. |
| `Stop` | housekeeping + flush + sync-data | Nag if a weekly review is overdue; **flush**'s SESSION-anchor ratchet nudges once when work landed this turn but `SESSION.md` wasn't touched (KIT-T014); **auto-commit + push `claude-kit-data`** when the centralized data repo is dirty (D-008), so a turn's `.ai/` edits persist without manual ceremony. |

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

## Exclusions — `.claude-kit-ignore.yaml` + in-source markers (KIT-T051)
Philosophy: **halts in anything but exclusions.** Every gate keeps its hard block by
default — the ONLY non-halt path is an explicit, documented exclusion. No check is
softened (magic numbers, `SELECT *`, file length, etc. all STAY blocks). The escape hatch
exists so a genuine false positive (or a generated tree the rule doesn't apply to) has an
obvious, committed way out. Every block/warn message ends with `excludeFooter(<check-id>)`,
which names the id and shows BOTH surfaces below. Both are **dependency-free** (tolerant
line-scan, no YAML dep) and **fail-open** (a malformed ignore file → no exclusions, never a
wedged write).

**1. Path globs — `.claude-kit-ignore.yaml` at the project root.** A map of `check-id →
[glob, ...]`; a `'*'` (alias `all`) key excludes from EVERY check. Globs are repo-root-
relative and support `**` (any depth), `*` (within a segment), `?`. Template:
`.claude-kit-ignore.yaml.example`.

```yaml
magic-numbers:
  - tools/asset-preview/**
  - "src/**/geometry/**"
file-length:
  - "src/generated/**"
"*":
  - vendor/**
```

**2. In-source markers** — exclude a code BLOCK or LINE in the file's own comments
(`//`, `#`, or `--` styles):

| Marker | Scope |
| --- | --- |
| `// claude-kit-ignore-file  <id\|all>` | the whole file |
| `// claude-kit-ignore-start <id\|all>` … `// claude-kit-ignore-end` | the lines between |
| `// claude-kit-ignore-line  <id\|all>` | the next line |
| `someCode();  // claude-kit-ignore <id\|all>` | that one line (trailing) |

**Check-ids** (named in every gate message, so you always know which key to use):

| Gate | Check-ids | Exclusion level |
| --- | --- | --- |
| `pre-write` | `todo-markers` · `dead-code` · `magic-numbers` · `select-star` · `sql-injection` · `file-length` · `broken-doc-links` | path glob **and** in-source markers (line/block for `magic-numbers`; whole-file for `file-length`) |
| `query-gate` | `store-grep` · `source-discovery` | path glob (on a path-ish command arg) |
| `jscpd` | `duplication` | path glob |
| `lint` | `lint` | path glob |
| `commit-gate` | `commit-log` | path glob (an excluded code path doesn't require a citation) |
| `request-gate` | `request-capture` | repo-wide glob over `.ai/` disables the gate (like `capture.enabled: false`) |

**lib helpers** (`hooks/lib.mjs`): `loadIgnoreConfig(root)` → `{ checkId: globs[] }`;
`pathExcluded(root, checkId, filePath)` → bool; `markerExcludedLines(source, checkId)` →
`{ wholeFile, lines:Set }`; `excludeFooter(checkId)` → the uniform footer string.

> Status: **fully ported to Node** — `lib`, `orient`, `commit-gate`, `flush`, `pre-write`,
> `lint`, `jscpd`, `housekeeping`. The hooks layer is Node-only; no bash hooks remain.
> Wired via `user-config/settings.recommended.json` + `bootstrap.sh`. Verified against
> mock payloads; the port fixes the bash bugs (const-skip, Windows backslash paths, the
> `python - <<heredoc` stdin bug that silently disabled lint/jscpd, and a gap-dedup key
> that never matched).
