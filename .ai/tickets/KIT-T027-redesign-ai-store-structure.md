---
id: KIT-T027
title: "Redesign the .ai store structure as first-class KIT-owned machinery (item model; reassess `notes`; triage/backlog as plugin code)"
type: feature
status: todo
priority: high
labels: [schema, store, triage, backlog, plugin, design]
links: [KIT-T004, KIT-T023, KIT-T024, KIT-T025, KIT-T026, KIT-D012]
files: [.ai/, scripts/, commands/]
created: 2026-06-04T15:55:00Z
updated: 2026-06-04T15:55:00Z
---

## Description
Maintainer: the `.ai` notes structure feels ad-hoc/"outside what we're doing," and "everything about
backlog triage etc. looks like KIT domain." Agreed — triage/backlog/inbox/drain/statuses/notes are
WORKFLOW MACHINERY owned by the plugin, not per-project hand-management. The project should hold only
its DATA (tickets/decisions); the STRUCTURE + mechanics should be first-class KIT code.

Redesign goals (research/design first):
- **Keep markdown-as-truth** (git-diffable, synced, human-readable, no hard DB dep) — that principle stays.
- **One clean item model** aligned to the schema the SQLite cache already defines (KIT-T004:
  items/links/artifacts/history). The stores should be a serialization of that model, not loose folders.
- **Reassess `notes`** — it overlaps `inbox` (freeform capture); decide: merge into inbox, or give it
  a distinct, defined role. Eliminate the ad-hoc bucket.
- **Triage/backlog/drain as plugin-owned code** (consistent across all adopting projects), not per-project
  improvisation — folds with KIT-T024/T025 (dedup/supersede), KIT-T026 (consume the cache), KIT-T023
  (active surfacing). This is the "context + workflow integrity" redesign as one coherent piece.

## Acceptance Criteria
- [ ] Design doc: the item model + store layout (what stays markdown, what `notes` becomes), the
      triage/backlog/drain mechanics as plugin code, migration from today's stores. Maintainer review.
- [ ] Reconciled with markdown-as-truth + the SQLite schema (KIT-T004) + dedup/supersede (T024/T025).

## Plan — Phase 1 slice: programmatic cross-project triage (`scripts/triage.mjs`)
The triage-as-code half of this ticket; the full store/item-model redesign stays for later.
Architecture — **gather → classify → apply**, cross-project, cache-first, LLM only in lockstep:
1. **GATHER (script).** Query the cache for ALL `store='inbox'` items across EVERY scope (cross-project
   by construction). Read each cap's `(type)` + body; load each project's `config.yml`
   classifications/routes/priorities; dedup-check via `q.mjs similar --store <target>`. Split into
   DETERMINISTIC (explicit type → `routes_to`/priority from config, no LLM) vs AMBIGUOUS (untyped prose).
   Emit a structured triage-plan JSON. (`triage.mjs --plan`)
2. **CLASSIFY (LLM, bounded lockstep).** Orchestrator classifies ONLY the ambiguous caps into a config
   classification, choosing from the script-provided allowed-set + dedup candidates. Pure text
   classification — NO file scanning, no goose chase. Returns a decisions JSON.
3. **APPLY (script).** Per decision: `q.mjs next-id` → write ticket from `_TEMPLATE` (or append to the
   active ticket / write question|note|decision per `routes_to`); apply dedup (skip/link/`supersedes`);
   mark the cap processed; sync the cache; print cross-project receipts + a drain-ordered worklist.
   (`triage.mjs --apply <decisions.json>`)
Why this shape: deterministic where config allows, LLM only for irreducible prose, never a file-scan;
cross-project; clears the now-cached inbox backlog; substrate for KIT-T006 (capture ratchet) + the
immediate-ingest hook. Awaiting maintainer OK before building (scope-gated per KIT-T038).

## Notes
- 2026-06-05: Phase 1 BUILT — `scripts/triage.mjs` (`--plan` / `--apply`) + atomic modules under
  `scripts/triage/` (config, cap-text, handle, plan, write-item, apply), `scripts/triage.test.mjs`
  (isolated fixture + throwaway registry/plugin-root — KIT-T035), and a thin `commands/triage.md`
  lockstep. `--plan` opens ONE held-open cache handle (KIT-D025) for all dedup searches (asserted
  via `dbHandleOpens: 1`); deterministic vs needsClassification split from each scope's
  `config.yml`; `--apply` mints ids via next-id on the held handle, writes from `_TEMPLATE.md`,
  folds/supersedes, moves caps to `inbox/triaged/`, re-syncs, prints receipts + drain worklist.
  Demo `--plan` on the real cache: 21 caps (2 HOD + 19 KIT), 12 deterministic / 9 to classify.
  The full store/item-model redesign (AC above) stays open.
- 2026-06-05: Plan above recorded for the triage slice; awaiting OK to build.
- 2026-06-04: Maintainer flagged the notes structure + that backlog/triage is KIT domain. Design TOGETHER
  with the T023/T024/T025/T026 cluster — one coherent KIT data/workflow redesign, not piecemeal.
