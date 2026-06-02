---
description: Pick up a ticket — restate acceptance criteria, confirm scope, then execute
argument-hint: <ticket-id>
---
Work ticket $ARGUMENTS per the contract:
1. Read `.ai/tickets/$ARGUMENTS*.md` and restate its acceptance criteria.
2. Confirm scope before editing files. Wait for OK if the plan changes scope or
   touches files not listed in the ticket.
3. Set status: doing. Mirror each acceptance criterion into the native task list
   (TaskCreate) for live progress.
4. Execute, checking `[x]` each criterion as satisfied and appending progress to
   the ticket's Notes.
5. When all criteria pass, set status: review, stop, and summarize the diff.
   Do not set status: done — that is Chris's call.
