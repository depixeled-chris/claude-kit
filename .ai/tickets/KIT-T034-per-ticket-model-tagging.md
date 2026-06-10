---
id: KIT-T034
title: "Per-ticket model tagging — drive subagent model from a ticket field by task complexity"
type: feature
status: todo
priority: high
milestone:
labels: [tokens, models, drain, config]
links: [KIT-D022, KIT-T030]
aka: []
files:
  - .ai/config.yml
  - .ai/tickets/_TEMPLATE.md
  - project-template/.ai/tickets/_TEMPLATE.md
  - commands/drain.md
  - commands/work.md
created: 2026-06-05T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Description
Implement the KIT-D022 model policy as a first-class ticket field so dispatch picks the right
model automatically instead of defaulting to the parent (Opus = the main token bleed).

## Acceptance Criteria
- [ ] Tickets carry an optional `model:` field (`opus|sonnet|haiku`).
- [ ] A default-by-type/complexity mapping in `.ai/config.yml` (e.g. epic/research/architecture
      → opus; bug/feature → sonnet; chore/format/cleanup → haiku) used when `model:` is unset.
- [ ] The drain/work contracts (`commands/drain.md`, `commands/work.md`) tell the orchestrator to
      pass the ticket's model (or the type default) as the Agent `model` when dispatching.
- [ ] Ticket templates document the field. Cross-platform, no code change required for the
      orchestrator to honor it (it's prose + config the orchestrator reads).
- [ ] **Effort axis (added 2026-06-10):** dispatch also sets reasoning effort — model and effort
      are one "firepower" decision, not two knobs. Either a parallel `effort:` field
      (`low|medium|high|xhigh|max` — verified to exist as command/skill frontmatter) or, preferred,
      a single `tier:` (light|standard|deep) expanding to BOTH (model, effort), with `model:`/
      `effort:` as optional explicit overrides. Needs a sibling decision to KIT-D022 (model-only).

## Notes
- 2026-06-05: Captured from maintainer directive (KIT-D022). Pairs with the token-mitigation
  research (docs/research/claude-code-subagent-token-mitigation.md). Complexity/breadth drives
  the choice — keep the mapping a sensible default, overridable per ticket.
- 2026-06-10: Maintainer asked "are we using frontmatter to assign the right model/effort per
  ticket?" Answer: no — command/skill frontmatter CAN'T. Its `model:`/`effort:` bind to the
  COMMAND and override only for the rest of the turn (verified vs code.claude.com docs), so they
  can't vary per ticket inside a drain loop. Clean application point = per-ticket SUBAGENT dispatch
  (Agent `model`/effort), exactly as the ACs already say. Net-new vs original spec: the EFFORT axis
  (AC above) — D022 + this ticket were model-only. Distinct (already-written, uncommitted) lever:
  fixed-cost read-only COMMANDS (standup/prime/triage/doc-audit) can carry a static `model:` since
  their cost is intrinsic — a command-level tweak, NOT this ticket's per-ticket routing. GATED:
  token-diet work is deferred behind M2–M4 per KIT-D031; this stays backlog until those land.
