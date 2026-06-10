---
id: KIT-T075
title: Store mutation CLI — t status / t tick / t link; hand-edits remain for prose only
type: feature
status: todo
priority: high
milestone: M2-close-the-loop
labels: [scripts, lifecycle, store]
files:
  - scripts/t.mjs
links: [KIT-T061, KIT-T063, KIT-T028, KIT-T026]
supersedes: KIT-T060
superseded_by:
created: 2026-06-10T03:55:00Z
updated: 2026-06-10T03:55:00Z
---

## Description
Structured mutations of the .ai store go through ONE tool instead of ad-hoc file edits
(maintainer call, 2026-06-09 → KIT-D032). Every store-integrity failure in the review
was a hand-edit failure: stale `doing` (T048), INDEX drift, template placeholder text
shipped in supersede fields, self-asserted statuses. The CLI centralizes the invariants;
markdown files stay the durable truth; prose sections (Description/Notes) stay
direct-edit.

Surface:
- `t status <id> <state>` — validates the transition against config.statuses, refuses
  `human_only` states unless `--human`, appends the History/Notes line, regenerates
  indexes, ingests the cache. `done` additionally archives (absorbs KIT-T060's /done:
  the command becomes a thin wrapper).
- `t tick <id> <criterion-ordinal|match>` — checks an acceptance box + Notes line.
- `t link <id> <rel> <target>` — typed links (supersedes pairing set on BOTH sides,
  regressed_from/causing_commit/fixed_commit), id-shape validated.
- All subcommands: fail loudly on unknown id; never invent ids (next-id.mjs owns minting).

## Acceptance Criteria
- [ ] `t status` enforces config.statuses flow + human_only guard; auto History line; index regen + cache ingest in the same invocation.
- [ ] `t status <id> done --human` archives to tickets/archive/ and prompts for fixed_commit on bug/regression types (KIT-T060 behavior absorbed).
- [ ] `t tick` and `t link` implemented with id/shape validation; supersedes writes both sides.
- [ ] /done command doc rewritten as a wrapper over `t status ... done --human`.
- [ ] /work + /drain docs updated: status flips and criterion ticks go through `t`, prose notes stay direct-edit.
- [ ] Tests: valid/invalid transitions, human_only refusal, done-tail (archive + index), tick, link both-sides, unknown id.

## Plan
1. scripts/t.mjs: frontmatter read/write (reuse id-utils/cache parsers), subcommands.
2. Wire index-tickets + ingest into mutations.
3. Rewrite /done as wrapper; update /work + /drain docs.
4. Tests.

## Notes
- 2026-06-09: opened from maintainer interjection during the M1 drain ("should we not add
  programmatic status updates?"). Decision KIT-D032: mutations programmatic, format stays
  markdown+frontmatter (YAML-only rejected). Supersedes KIT-T060 (standalone /done) — its
  flip-tail requirements live on here as criterion 2.
