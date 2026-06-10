---
description: Catch up — cross-project "what needs me?" briefing by default, or a deep resume of named project(s)
model: sonnet
argument-hint: "[project ...]"
---
`/prime` catches us BOTH up after a gap — a freshly-wiped you (Claude) and a human whose
memory has faded over a night's sleep. It reads the on-disk record (which outranks any
summary or memory) and produces a briefing a person can skim.

## Your role: ORCHESTRATOR
Your role + operating rules are established every session by the orient SessionStart hook (the
`IDENTITY & OPERATING MODE` block) — you are the ORCHESTRATOR: delegate substantive work to
subagents, keep the main thread to coordination, and put every question to the human through
AskUserQuestion with a recommended option. `/prime` does not define this; it only catches you up.

## Gather the facts
Run the survey script and read its output:

```
node "<KIT>/scripts/survey.mjs" $ARGUMENTS
```

Resolve `<KIT>` (the claude-kit repo/plugin root) as: `$CLAUDE_PLUGIN_ROOT` if set, else the
`claude-kit` entry in `~/.claude/claude-kit-projects.json`. (`$ARGUMENTS` = any project names
the user passed.)

## Two modes

**No project named → be LAZY, but thorough about "what needs me?"**
Present the survey as a human briefing, in this order:
1. **Waiting on you** — verbatim, first. Decisions pending, tickets in `review`, blocked-on-you
   items, aggregated across every project. This is the part that must be complete.
2. **Open work by project** — the one-line-per-project summary. Don't expand it.
3. **Active project** — the deep view of the project you're sitting in (the `→` one). Restate
   its goal and the next 3 steps; confirm scope before doing work.
Do **not** deep-read the other projects — that's the whole point of lazy.

**One or more projects named → deep resume of each.**
Full SESSION + open tickets + working-tree state for the named project(s), even if you're
sitting in a different folder. Restate goal + next steps, confirm scope, continue.

## Reconcile git against the plan (D-010)
The survey includes each project's working-tree temperature (uncommitted + unpushed, incl.
`watch_repos`). git state is part of the record — surface drift (work on disk the plan omits,
or "done" work that's actually unpushed); never assume "pushed = done."

A project shown as "no local repo on this machine" appears from synced notes only — its git
state can't be read here; say so rather than implying it's clean.
