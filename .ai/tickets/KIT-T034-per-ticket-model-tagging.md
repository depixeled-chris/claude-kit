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
updated: 2026-06-05T00:00:00Z
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

## Notes
- 2026-06-05: Captured from maintainer directive (KIT-D022). Pairs with the token-mitigation
  research (docs/research/claude-code-subagent-token-mitigation.md). Complexity/breadth drives
  the choice — keep the mapping a sensible default, overridable per ticket.
