---
description: Drain INBOX.md into tickets/questions/decisions and report a prioritized worklist
---
Drain `.ai/INBOX.md`:
1. Classify each line against `.ai/config.yml` → classifications.
2. Promote it to its destination — create/append a ticket (use
   `.ai/tickets/_TEMPLATE.md`), a question, a note, or a decision. **Allocate the id
   with `node <kit>/scripts/next-id.mjs <store>` — never hand-pick one** (that is what
   collided two files on one id; KIT-T009). Name the file `<id>-<slug>.md`.
3. Dedupe against existing items IN THE TARGET STORE — `node <kit>/scripts/q.mjs similar --store
   <tickets|decisions|notes|questions> "<proposed title/labels>"` surfaces likely duplicates (FTS,
   suggest-only; omit `--store` for tickets). `next-id.mjs <store> -- <proposed title>` runs the
   same check automatically and prints any hit on stderr (KIT-T025). On a real duplicate either skip
   it, link it (`links:`), or — if it RETIRES an older one — set `supersedes: <old-id>` on the new
   item and `superseded_by: <new-id>` (or `status: superseded`) on the old, which drops the old from
   the board + drain (KIT-T024). For regressions, link the likely causing commit.
4. Delete promoted lines from INBOX.md.
5. Report the resulting prioritized worklist (drain order from config, roadmap
   first if a current milestone exists). Flag items that are Chris's call.
Do not start implementing — this is triage only.
