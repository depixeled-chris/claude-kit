---
description: Drain INBOX.md into tickets/questions/decisions and report a prioritized worklist
---
Drain `.ai/INBOX.md`:
1. Classify each line against `.ai/config.yml` → classifications.
2. Promote it to its destination — create/append a ticket (use
   `.ai/tickets/_TEMPLATE.md`), a question, a note, or a decision.
3. Dedupe against existing tickets; for regressions, link the likely causing
   commit. Skip anything already captured.
4. Delete promoted lines from INBOX.md.
5. Report the resulting prioritized worklist (drain order from config, roadmap
   first if a current milestone exists). Flag items that are Chris's call.
Do not start implementing — this is triage only.
