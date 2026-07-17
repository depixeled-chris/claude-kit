---
id: KIT-T128
title: Living model-routing hierarchy: standard tier -> opus, sonnet off the coding ladder (Chris directive 2026-07-16)
type: request
status: done
priority: medium
milestone:
labels: []
links: [KIT-D035, KIT-D042, KIT-D043, KIT-T109]
files: [.ai/config.yml, project-template/.ai/config.yml, user-config/CLAUDE.global.md, .ai/decisions/KIT-D043-standard-tier-opus-sonnet-off-the-coding-ladder.md]
supersedes:
superseded_by:
created: 2026-07-17T01:34:38Z
updated: 2026-07-17T01:38:22Z
fixed_commit: fd2f925
---

## Description
Chris (2026-07-16, refined; re-stated 2026-07-17 post-clear): the subagent
model-routing policy captured as a groovegrid project memory
(`delegate-basics-off-fable`) is in the WRONG home. "That shouldn't be a project
memory. That should be core to Claude Kit and it should be a living hierarchy
because things change." The kit's firepower ladder (KIT-D035/KIT-D042,
`config.dispatch.tiers`) IS that hierarchy — but its `standard` tier still
routes everyday coding to sonnet, which the directive forbids (Sonnet 5's
4.7-era tokenizer costs ~1x-1.35x the tokens of 4.6 at the same per-token
price, eroding its efficiency edge; Opus 4.8 codes better). Promote the policy
into the ladder + global contract; retire the project memory.

## Acceptance Criteria
- [x] KIT-D043 records: standard tier -> opus; sonnet off the coding ladder
      (valid only as an explicit per-ticket override); haiku for trivial
      mechanical work; fable deep-only, budget permitting, relaunch on opus at
      a fable limit error; the ladder is the LIVING hierarchy — model choices
      are dated judgments updated at source when the lineup changes, never
      frozen in a per-project memory.
- [x] `.ai/config.yml` `dispatch.tiers.standard` = (opus, medium) with a dated
      rationale comment.
- [x] `project-template/.ai/config.yml` matches (new projects scaffold the
      corrected ladder).
- [x] `user-config/CLAUDE.global.md` carries the ad-hoc delegation rule (Agent
      tool outside ticket dispatch follows the same ladder) so it applies in
      every session, every repo.
- [x] Inbox capture `2026-07-16-directive-non-fable-agents-for-basic-work.md`
      consumed by this promotion (deleted).
- [x] groovegrid project memory `feedback_delegate_basics_off_fable.md` +
      MEMORY.md index line removed (content now structural in the kit).
- [x] `~/.claude/CLAUDE.md` recomposed via `node bootstrap.mjs`.

## Plan
1. Write KIT-D043 (decision doc).
2. Update both config.yml tiers blocks.
3. Add SUBAGENT DISPATCH section to CLAUDE.global.md.
4. Delete inbox capture; regenerate views (index-tickets.mjs).
5. bootstrap.mjs recompose; delete groovegrid memory; commit + push.

## History
- [2026-07-17 01:34] (created) request — Living model-routing hierarchy: standard tier -> opus, sonnet off the coding ladder (Chris directive 2026-07-16)
- [2026-07-17 01:35] (status) todo → doing
- [2026-07-17 01:36] (comment) ticked: KIT-D043 records: standard tier -> opus; sonnet off the coding ladder
- [2026-07-17 01:36] (comment) ticked: `project-template/.ai/config.yml` matches (new projects scaffold the
- [2026-07-17 01:36] (comment) ticked: Inbox capture `2026-07-16-directive-non-fable-agents-for-basic-work.md`
- [2026-07-17 01:36] (comment) ticked: `~/.claude/CLAUDE.md` recomposed via `node bootstrap.mjs`.
- [2026-07-17 01:37] (comment) ticked: `.ai/config.yml` `dispatch.tiers.standard` = (opus, medium) with a dated
- [2026-07-17 01:37] (comment) ticked: `user-config/CLAUDE.global.md` carries the ad-hoc delegation rule (Agent
- [2026-07-17 01:37] (comment) ticked: groovegrid project memory `feedback_delegate_basics_off_fable.md` +
- [2026-07-17 01:38] (status) doing → done
