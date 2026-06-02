# DECISIONS

Append-only. One entry per settled point — what was decided, what was rejected,
and why. This is what lets Claude make judgment calls without re-asking and
stops every new session from re-proposing a discarded approach.

**Never delete entries.** To reverse a decision, append a new one that
supersedes it and reference the old id.

Format:

```
## YYYY-MM-DD  <short title>  [D-001]
Decided: <the choice>.
Rejected: <the alternative>. Why: <reason>.
```

<!-- example:
## 2026-06-01  Refresh trigger strategy  [D-001]
Decided: proactive refresh at t-5min via timer.
Rejected: refresh-on-401. Why: causes a failed request + retry storm under
concurrency; user sees a flicker. Don't revisit unless we drop the timer infra.
-->

## 2026-06-02  claude-kit is the single source of truth for all Claude tooling  [D-001]
Decided: every Claude *tool* — hooks, slash commands, statusline, the settings
template, and the global CLAUDE.md rules — is authored and versioned HERE. `~/.claude`
becomes a derived install: `bootstrap.sh` symlinks/merges from the kit. Reproduce a
machine with `git clone && ./bootstrap.sh`.
Rejected: hand-maintaining `~/.claude` per machine. Why: it's unversioned and
machine-local, silently drifts across machines, and can't be reproduced — exactly the
amnesia this kit exists to kill. Nothing tooling-related is authored in two places.

## 2026-06-02  Public kit + private overlay  [D-002]
Decided: the kit is public + MIT and holds NON-proprietary content only. Anything
sensitive — personal CLAUDE.md rules, proprietary product strategy/research, private
agents — lives in a separate **private overlay** (a private repo or a gitignored
`~/.claude/private/`). `bootstrap.sh` composes public + private.
Rejected: one public file scrubbed by hand each time. Why: a structural boundary means
secrets cannot reach the MIT repo by construction, instead of relying on the author (or
Claude) to scrub correctly every time.

## 2026-06-02  Enforcement hooks are portable Node, installed globally but opt-in-aware  [D-003]
Decided: hooks are written in Node, installed once per machine from the kit, and
`exit 0` immediately unless the project has `.ai/`. "Global install" then never
interferes with unadopted projects, and nothing is copied into individual repos.
Rejected: bash/OS-shell hook scripts; per-project hook copies. Why: bash hooks hit
Windows/MSYS + Python path bugs and a heredoc-stdin bug that silently disabled a hook
(observed directly); Node is portable. Per-project copies = "two places" to maintain.

## 2026-06-02  The kit is also the cross-project research KB + non-proprietary agent library  [D-004]
Decided: `research/` (indexed, generic findings) and `agents/` (non-proprietary agent
definitions, improved by iteration) live in the kit. Discipline: check the KB before
researching; update in place; one place to reference and update.
Rejected: per-project research silos; bulk-importing existing project research. Why:
reuse across projects; and product/strategy-specific research (and anything citing
proprietary/unlicensed frameworks) must stay private — migration is a per-doc
classification, not a bulk move.
