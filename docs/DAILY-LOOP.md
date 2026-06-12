# Daily loop

The cheat sheet. Print it, pin it.

## Start (any machine)
```
git pull
claude                 # fresh session — NOT --continue (sessions don't cross machines)
/prime                 # reads SESSION.md + active ticket, confirms scope, continues
```

## Capture (anytime, zero interruption)
```
cap bug form double-submits on slow network
cap feature dark-mode persists across reloads
cap question why is the TTL hardcoded?
cap just a thought about the cache layer        # untyped → classified at triage
```
Or mid-session, just say it — Claude routes it and gives a one-line receipt:
`→ BUG-024 logged (high), still on KIT-T001`.

## Triage (start of day, or when inbox piles up)
```
/triage
```
Drains `inbox/` → `tickets/`/`questions/`/`decisions/`, dedupes, links regressions,
reports a prioritized worklist.

## Work
```
/work KIT-T001
```
Claude restates acceptance criteria, **confirms scope**, sets `doing`, mirrors
criteria to the native task list, executes ticking boxes, then sets `review` (or
`done` when `config.uat: none`) and summarizes. You set `done` after merge
(human-only on projects with `uat: required`).

Between tickets Claude pulls the next item itself via the drain rules — you don't
have to ask. Or call `/drain` explicitly to pull the next item.

## Decisions
```
/decide
```
Batch any pending `questions/` into a questionnaire. Claude answers the
`answerable_by: claude` ones automatically; only the `answerable_by: chris` ones
surface to you. Answers are written back to the question file (never deleted).

## Standup / status
```
/standup     # mid-flight glance — no changes, no resume
/status      # same but from cache; faster
/prime       # full resume: reads SESSION.md + active ticket, continues
```

## Direct attention
- "stop, this matters now" → forces a block, discuss.
- "just log it" → forces deferral even if it looked blocking.
- "work T-007 instead" → switch active ticket.
- Reopen a settled point → Claude cites the decision instead of re-debating.

## Context watch
Statusline shows `ctx:NN%`. At ~75%:
```
/flush                 # write state to SESSION.md + DECISIONS.md
/clear                 # then /prime          (preferred at milestones)
```
or, mid-task only:
```
/flush
/compact Preserve verbatim: acceptance-criteria checklist, exact commands and
file:line refs, the current in-flight TODO, and rejected approaches.
```

## End
```
/flush                 # write current state + next-3-steps to SESSION.md
git add <files>        # explicit pathspecs — never -a/-A (the commit gate enforces this)
git commit -m "wip: <state> (implements T-NNN)"   # cite the ticket; gate blocks uncited commits
git push
```
