---
id: KIT-T034
title: "Per-ticket model tagging — drive subagent model from a ticket field by task complexity"
type: feature
status: done
priority: high
milestone:
labels: [tokens, models, drain, config]
links: [KIT-D022, KIT-T030, KIT-D035, KIT-T078]
aka: []
files:
  - .ai/config.yml
  - .ai/tickets/_TEMPLATE.md
  - project-template/.ai/tickets/_TEMPLATE.md
  - commands/drain.md
  - commands/work.md
created: 2026-06-05T00:00:00Z
updated: 2026-06-11T06:11:57Z
---

## Description
Implement the KIT-D022 model policy as a first-class ticket field so dispatch picks the right
model automatically instead of defaulting to the parent (Opus = the main token bleed).

## Acceptance Criteria
- [x] Tickets carry an optional `model:` field (`opus|sonnet|haiku`).
- [x] A default-by-type/complexity mapping in `.ai/config.yml` (e.g. epic/research/architecture
      → opus; bug/feature → sonnet; chore/format/cleanup → haiku) used when `model:` is unset.
- [x] The drain/work contracts (`commands/drain.md`, `commands/work.md`) tell the orchestrator to
      pass the ticket's model (or the type default) as the Agent `model` when dispatching.
- [x] Ticket templates document the field. Cross-platform, no code change required for the
      orchestrator to honor it (it's prose + config the orchestrator reads).
- [x] **Effort axis (added 2026-06-10):** dispatch also sets reasoning effort — model and effort
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
- 2026-06-11: IMPLEMENTED (worked by direct maintainer delegation — ticket handed over `doing`,
  same basis KIT-T078 landed against D031: the effort is being spent now and it touches no
  integrity/gate machinery D031 protects). Design as built:
  - `config.dispatch` block in `.ai/config.yml` is the firepower spec: `tiers` map
    light/standard/deep → (model, effort); `default_tier` maps ticket `type` → a tier (with `*`
    catch-all). Resolution order, first hit wins: explicit ticket `model:`/`effort:` (per-axis
    override) → ticket `tier:` → `default_tier[type]`. Effort values low|medium|high|xhigh|max.
  - AC #5 resolved with the ticket's PREFERRED shape (`tier:` expanding to both axes, `model:`/
    `effort:` as optional per-axis overrides) — not invented; the AC named it "preferred". The
    sibling decision it required is KIT-D035 (the effort axis on top of D022's model-only).
  - Both ticket templates document the three optional fields in frontmatter comments.
  - `commands/drain.md` (step 2) + `commands/work.md` (step 3) instruct the orchestrator to
    resolve firepower from `config.dispatch` and pass Agent `model`/`effort` at delegation.
  - NO code/parser touched (AC #4: "no code change required … prose + config the orchestrator
    reads"). Deliberately did NOT add `model`/`tier` to `db-parse.mjs` row model: nothing consumes
    an indexed firepower field, and KIT-D030 (no config vapor) says ship the knob with its
    consumer — the consumer here is the orchestrator reading markdown, not the cache. Stayed out
    of `hooks/lib.mjs` entirely (KIT-T021 in-flight; not in this ticket's `files:` anyway).
  - KNOWN GAP (not a regression, fields are OPTIONAL): `t new` (scripts/t.mjs `scaffoldNew`)
    hardcodes its frontmatter and does NOT read `_TEMPLATE.md`, so minted tickets won't carry the
    comment lines. Correctness is unaffected — an absent field falls back to `default_tier[type]`.
    Adding the fields to the scaffolder is a follow-up (t.mjs is outside this ticket's `files:`).
  - [no-test: config + prose only; the field is read by the orchestrator at dispatch, not by code,
    so there is no executable behavior to assert. Verified instead that every config.yml reader is
    line-wise/regex (t.mjs readConfig, db-parse, id-utils, triage/config, cap, sync-tasks) and
    ignores the new top-level `dispatch:` block — confirmed green by the full suite below.]

## History
- [2026-06-11 06:02] (status) todo → doing
- [2026-06-11 06:11] (comment) ticked: Tickets carry an optional `model:` field (`opus|sonnet|haiku`).
- [2026-06-11 06:11] (comment) ticked: The drain/work contracts (`commands/drain.md`, `commands/work.md`) tell the orchestrator to
- [2026-06-11 06:11] (comment) ticked: **Effort axis (added 2026-06-10):** dispatch also sets reasoning effort — model and effort
- [2026-06-11 06:11] (comment) ticked: A default-by-type/complexity mapping in `.ai/config.yml` (e.g. epic/research/architecture
- [2026-06-11 06:11] (comment) ticked: Ticket templates document the field. Cross-platform, no code change required for the
- [2026-06-11 06:11] (status) doing → done
