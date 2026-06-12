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
   When delegating, ROUTE to the right agent (KIT-T015):
   - Check for a project-local knowledge-agent at `<repo>/.claude/agents/<domain>.md` first.
     If one exists, route there — it carries conventions, past gotchas, and the out-of-scope
     guard so you don't need to re-explain them in the task prompt.
   - Else use the closest generic kit agent (researcher / refactorer / test-author /
     code-reviewer); bare general-purpose is the last resort.
   - Include these standard handoff guards in every delegation brief:
     > **Out-of-scope / legacy guard:** do not touch files, modules, or subsystems outside
     > the ticket's stated scope. If a fix traces to legacy or deprecated code outside your
     > domain, STOP and surface it — don't expand scope unilaterally.
     >
     > **Verify as the user plays:** after completing your change, exercise it as the user
     > would — run the test suite, start the app, or hit the probe — and report empirical
     > evidence (exit code, rendered output, probe readings). A compile-check alone is not
     > verification.
4. Execute. Tick each criterion as satisfied with `node <kit>/scripts/t.mjs tick $ARGUMENTS
   <ordinal|match>`; append narrative progress to the ticket's Notes by hand (prose).
5. When all criteria pass, `node <kit>/scripts/t.mjs status $ARGUMENTS review`, stop, and
   summarize the diff. Close (`status … done`) is gated by `config.uat`: agent-callable when it
   resolves `none` for the ticket (KIT-D034), else the maintainer's call via `/done`.

**BIG-ASK TRIGGER (KIT-T038):** when a request exceeds a size/risk threshold — long prompt AND a scope/risk signal (redesign, architecture, migrate, from scratch, overhaul, end-to-end, system-wide, etc.) — do NOT one-shot it. Route it into the structured pipeline: plan → research doc (`docs/research/`) → decompose into tickets → drain. Routine asks are unaffected. The `UserPromptSubmit` hook nudges this automatically; this prose is the authoritative rule for the contract.

**STATUS TRANSITIONS ARE MANDATORY (KIT-T028):** leaving a ticket in the wrong status is a
process failure — a zombie `doing` surfaces as a nag on every subsequent session start.
- Start work → set `doing` immediately (step 3 above).
- Finish work → set `review` (or `done` when uat=none).
- Bail / stop early / get reverted → set `todo` before exiting.
Never leave a ticket `doing` when you stop touching it.
