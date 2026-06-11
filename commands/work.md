---
description: Pick up a ticket — restate acceptance criteria, confirm scope, then execute
argument-hint: <ticket-id>
---
If no ticket id is given, do NOT guess one — tell the maintainer to use `/drain` (auto-pull
the next item) and stop. With an id, work exactly that ONE ticket and stop at `review`.

STRUCTURED mutations go through the `t` CLI (KIT-T075), never hand-edited frontmatter: status
flips (`t status <id> <state>`) and criterion ticks (`t tick <id> <ordinal|match>`) — each
validates, stamps History, regenerates the board, and ingests the cache in one invocation.
PROSE (Description / Notes body) stays direct-edit (Edit). `<kit>` = the claude-kit scripts dir.

Work ticket $ARGUMENTS per the contract:
1. Read `.ai/tickets/$ARGUMENTS*.md` and restate its acceptance criteria.
2. Confirm scope before editing files. Wait for OK if the plan changes scope or
   touches files not listed in the ticket.
3. `node <kit>/scripts/t.mjs status $ARGUMENTS doing`. Mirror each acceptance criterion
   into the native task list (TaskCreate) for live progress. If you DELEGATE this ticket to a
   subagent, set its firepower from `config.dispatch` (KIT-T034): pass the Agent `model`/`effort`
   resolved as — explicit ticket `model:`/`effort:` (per-axis override), else ticket `tier:`
   expanded via `dispatch.tiers`, else `dispatch.default_tier` for the ticket's `type` (then the
   `*` catch-all). One `tier` sets BOTH model and effort; never inherit the parent model by
   default (Opus-inheritance is the token bleed — KIT-D022).
4. Execute. Tick each criterion as satisfied with `node <kit>/scripts/t.mjs tick $ARGUMENTS
   <ordinal|match>`; append narrative progress to the ticket's Notes by hand (prose).
5. When all criteria pass, `node <kit>/scripts/t.mjs status $ARGUMENTS review`, stop, and
   summarize the diff. Close (`status … done`) is gated by `config.uat`: agent-callable when it
   resolves `none` for the ticket (KIT-D034), else the maintainer's call via `/done`.

**STATUS TRANSITIONS ARE MANDATORY (KIT-T028):** leaving a ticket in the wrong status is a
process failure — a zombie `doing` surfaces as a nag on every subsequent session start.
- Start work → set `doing` immediately (step 3 above).
- Finish work → set `review` (or `done` when uat=none).
- Bail / stop early / get reverted → set `todo` before exiting.
Never leave a ticket `doing` when you stop touching it.
