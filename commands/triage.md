---
description: Drain the inbox into tickets/questions/decisions and report a prioritized worklist
model: sonnet
---
Cross-project triage runs in lockstep with `scripts/triage.mjs` — the SCRIPT gathers and
applies; you (the LLM) only classify the irreducible-prose caps in between. Do NOT scan the
inbox or the stores by hand; the script already did.

1. **GATHER** — run `node <kit>/scripts/triage.mjs --plan --json`. Triage is ALWAYS
   cross-project (KIT-D026): run with NO `--scope` so it drains every project's inbox in
   one pass. Add `--scope <KEY>` ONLY when the maintainer explicitly names one project to
   confine to — never narrow it unbidden. It opens the cache ONCE, reads every
   `store='inbox'` cap cross-project, and emits a plan: per cap `{capId, scope, text,
   type, route, priority, needsClassification, dedupCandidates, allowedClassifications}`.

2. **CLASSIFY** — build `decisions.json` (an array). For each plan item:
   - `needsClassification: false` (DETERMINISTIC — it had an explicit `(type)`): auto-include
     it unchanged — `{capId, classification: type, route, priority, action: "create"}`. No LLM
     judgment needed.
   - `needsClassification: true` (AMBIGUOUS prose): pick ONE classification from THIS cap's
     `allowedClassifications`, considering its `dedupCandidates`. PURE text classification —
     do NOT open files or chase references. Choose an `action`:
       - `create` — a new item (the default).
       - `fold` — it belongs to an existing item; set `target: <id>` (append a dated note).
       - `supersede` — it RETIRES an existing item; set `target: <old-id>` (the script sets
         `supersedes`/`superseded_by` and writes the new item).
       - `skip` — noise; nothing is written.
     Optional `links: [<id>...]`. The script resolves `route`/`priority` from config for caps
     where you omit them; pass them only to override.

3. **APPLY** — run `node <kit>/scripts/triage.mjs --apply decisions.json`. It allocates ids
   with `next-id` (NEVER hand-pick — KIT-T009), writes each item from its store's
   `_TEMPLATE.md`, folds/supersedes as directed, MOVES every processed cap to `inbox/triaged/`
   (never deletes), re-syncs the cache, and prints cross-project receipts + a drain-ordered
   worklist per scope.

This is triage only — do not start implementing the promoted work.
