---
id: KIT-T127
title: Fable-aware dispatch: deep tier prefers fable with opus fallback
type: feature
status: done
priority: medium
milestone:
labels: [tokens, models, dispatch, config]
links: [KIT-D022, KIT-D035, KIT-T034, KIT-D042]
files:
  - .ai/config.yml
  - project-template/.ai/config.yml
  - .ai/tickets/_TEMPLATE.md
  - project-template/.ai/tickets/_TEMPLATE.md
  - commands/work.md
  - .ai/decisions/KIT-D042-fable-in-the-firepower-ladder.md
supersedes:
superseded_by:
created: 2026-07-15T14:52:36Z
updated: 2026-07-15T14:57:24Z
---

## Description
The Claude 5 family adds `fable` (Mythos-class, above Opus) as a valid Agent `model` value; the
kit's KIT-T034/KIT-D035 firepower ladder predates it and tops out at opus. Maintainer directive
(2026-07-15): fable is PREFERRED for planning / really hard problem solving, but may not always
be available — dispatch must fall back to opus. Build fable + fallback semantics into the
dispatch config, templates, and the /work delegation contract.

## Acceptance Criteria
- [x] `dispatch.tiers.deep` resolves to `model: fable` with `fallback: opus` in BOTH
      `.ai/config.yml` and `project-template/.ai/config.yml`, with the fallback semantics
      documented in the dispatch comment block.
- [x] Ticket templates (kit + project-template) list `fable` among valid `model:` override values.
- [x] `commands/work.md` step 3 tells the orchestrator to retry with the tier's `fallback` model
      when the primary is unavailable at dispatch, and notes Workflow `agent()` `model`/`effort`
      opts as the same application point.
- [x] Sibling decision KIT-D042 records the fable-with-fallback policy (extends KIT-D022/KIT-D035).

## Plan
1. Update both config.yml dispatch blocks (deep tier + comments).
2. Update both ticket template `model:` comments.
3. Update work.md step 3 (fallback rule + Workflow parity).
4. Write KIT-D042.

## Notes
- 2026-07-15: Implemented as planned. Design: `fallback:` is a new OPTIONAL per-tier key in
  `dispatch.tiers` — availability handling only (retry the same delegation, note it in the
  receipt), never a silent cost downgrade. No code parses it (same basis as KIT-T034: the
  orchestrator reads the config at dispatch). Full test suite green after the config change,
  confirming the line-wise config readers ignore the new key. Rejected a fourth tier and
  override-only fable per KIT-D042. drain.md needed no edit — it defers dispatch to /work.

## History
- [2026-07-15 14:52] (created) feature — Fable-aware dispatch: deep tier prefers fable with opus fallback
- [2026-07-15 14:53] (status) todo → doing
- [2026-07-15 14:56] (comment) ticked: `dispatch.tiers.deep` resolves to `model: fable` with `fallback: opus` in BOTH
- [2026-07-15 14:56] (comment) ticked: `commands/work.md` step 3 tells the orchestrator to retry with the tier's `fallback` model
- [2026-07-15 14:56] (comment) ticked: Ticket templates (kit + project-template) list `fable` among valid `model:` override values.
- [2026-07-15 14:56] (comment) ticked: Sibling decision KIT-D042 records the fable-with-fallback policy (extends KIT-D022/KIT-D035).
- [2026-07-15 14:57] (status) doing → done
- [2026-07-15 14:57] (comment) fable+fallback dispatch shipped; suite green
