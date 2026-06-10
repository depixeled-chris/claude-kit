---
id: KIT-T048
title: Provenance enforcement — q trail (walk-up summary), ticket-start gate, missing-antecedent lint, item summaries
type: feature
status: todo
priority: high
milestone: M3-provenance
labels: [process, provenance, hooks]
links: [KIT-D028]
files: [scripts/q.mjs]
supersedes:
superseded_by:
created: 2026-06-06T07:50:00Z
updated: 2026-06-06T07:50:00Z
---

## Description
Implement the provenance law ([[KIT-D028]]): make the trail enforced by hooks, not the agent's memory. Inception-out links + trail-on-action, the standard issue-tracker shape (epics/parent/typed links). Surfaced summaries must be token-frugal with a drill-in clue.

## Acceptance Criteria
- [x] `q trail <id>` — walks UP the ancestry (ANCESTOR_RELS: link/parent/supersedes/regressed_from/introduced_by/caused_by), decisions+docs first, robust to prose/junk link targets (id/sha shape only).
- [x] Token-frugal output: clipped one-line gist (80c) + `✎` clue when a node has more detail to drill into; no full-title/body dumps.
- [ ] Each item carries a concise `summary:` frontmatter (parser exposes it; `q trail` prefers it over the clipped title). Backfill summaries on key decisions.
- [ ] Ticket-start gate: when a ticket flips to `doing`, surface its trail; BLOCK acting on a trail-less item (no outbound antecedent link).
- [ ] Missing-antecedent lint: flag any item with no outbound antecedent link (orphan in the provenance graph).
- [ ] Research/design docs indexed as trail nodes (depends on KIT-T041/T042) so docs (e.g. R050) appear in trails.
- [ ] `q trail` exposed in orient for the in-flight `doing` ticket.

## Plan
1. [done] `q trail` walk-up + token-frugal output (scripts/q.mjs).
2. summary field convention + parser + backfill.
3. ticket-start gate hook + missing-antecedent lint.
4. doc indexing (KIT-T041/T042) so docs join trails.

## Notes
- 2026-06-06: `q trail` shipped and dogfooded on HOD-T106 — it PROVES the failure that started this: T106's trail surfaces D015/D017/D010/D016… but NEVER reaches HOD-D003 (Rust owns world-gen), because the inception-out link to D003 was never authored; it also flags HOD-D007 as dangling and the wrong HOD-D017 in the chain. Data reconciliation (link T106/T107→D003, dispose of D017) is maintainer-gated (edits were halted).
- 2026-06-09: was stale `doing` (phase 1 shipped in 4448742; no active work). Re-queued `todo` under M3-provenance — remaining criteria (summary frontmatter, ticket-start gate, antecedent lint, doc indexing, orient exposure) are M3 scope alongside KIT-T065/T066; doc-indexing criterion stays gated on KIT-T041/T042.
