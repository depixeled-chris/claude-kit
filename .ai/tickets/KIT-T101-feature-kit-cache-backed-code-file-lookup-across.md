---
id: KIT-T101
title: (feature, KIT) CACHE-BACKED CODE/FILE LOOKUP across lineage repos. Today the code-graph (KIT-T012, ~/.claude/cache/code-graph/<repo>.json) indexes only the ACTIVE repo and has NO q.mjs query verb, so the agent falls back to Glob/find — and cross-repo lookups (e.g. locate mesh.rs in wordslide-codex/rapid-game, a lineage repo HOD references) aren't cached at all. Two asks: (1) extend the code-graph to ALSO index lineage/watch_repos (the sibling repos declared in lineage) so cross-repo file/symbol lookup is cached; (2) add q.mjs verbs (e.g. 'q file <glob>', 'q sym <name>', 'q code <text>') that serve the code-graph so the agent queries the cache instead of filesystem find. Goal: file/symbol search hits the DB cache, fast, cross-repo — the maintainer wants to tweak the cache for exactly this. (3) DOCS IN FTS, CODE AS GRAPH (not full-text): code is represented by the CODE-GRAPH only — files/symbols/refs for 'q file'/'q sym' lookup; do NOT full-text-index code source. DOCUMENTATION (prose) goes in the FTS text-search cache: index docs/research, docs/design, docs/strategy (+ cross-repo lineage docs) so 'q fts' covers DOCS + workflow items (tickets/decisions) uniformly. So two query paths, both via q.mjs: q file/q sym → code-graph (structure); q fts → docs + workflow prose. This generalizes KIT-T041/T042 (research-doc FTS index) and keeps it distinct from the KIT-T012 code-graph. Links KIT-T012 (code-graph), KIT-T041/T042 (doc index), KIT-D024 (all-stores-in-cache). Project: KIT.
type: feature
status: todo
priority: medium
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.630Z
updated: 2026-07-14T17:40:14.630Z
---

## Description
(feature, KIT) CACHE-BACKED CODE/FILE LOOKUP across lineage repos. Today the code-graph (KIT-T012, ~/.claude/cache/code-graph/<repo>.json) indexes only the ACTIVE repo and has NO q.mjs query verb, so the agent falls back to Glob/find — and cross-repo lookups (e.g. locate mesh.rs in wordslide-codex/rapid-game, a lineage repo HOD references) aren't cached at all. Two asks: (1) extend the code-graph to ALSO index lineage/watch_repos (the sibling repos declared in lineage) so cross-repo file/symbol lookup is cached; (2) add q.mjs verbs (e.g. 'q file <glob>', 'q sym <name>', 'q code <text>') that serve the code-graph so the agent queries the cache instead of filesystem find. Goal: file/symbol search hits the DB cache, fast, cross-repo — the maintainer wants to tweak the cache for exactly this. (3) DOCS IN FTS, CODE AS GRAPH (not full-text): code is represented by the CODE-GRAPH only — files/symbols/refs for 'q file'/'q sym' lookup; do NOT full-text-index code source. DOCUMENTATION (prose) goes in the FTS text-search cache: index docs/research, docs/design, docs/strategy (+ cross-repo lineage docs) so 'q fts' covers DOCS + workflow items (tickets/decisions) uniformly. So two query paths, both via q.mjs: q file/q sym → code-graph (structure); q fts → docs + workflow prose. This generalizes KIT-T041/T042 (research-doc FTS index) and keeps it distinct from the KIT-T012 code-graph. Links KIT-T012 (code-graph), KIT-T041/T042 (doc index), KIT-D024 (all-stores-in-cache). Project: KIT.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
