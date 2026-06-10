---
id: KIT-T075
title: Store mutation CLI — t status / t tick / t link; hand-edits remain for prose only
type: feature
status: review
priority: high
milestone: M2-close-the-loop
labels: [scripts, lifecycle, store]
files:
  - scripts/t.mjs
  - hooks/ingest-data.mjs
  - commands/done.md
  - commands/work.md
  - commands/drain.md
  - scripts/t.test.mjs
links: [KIT-T061, KIT-T063, KIT-T028, KIT-T026]
supersedes: KIT-T060
superseded_by:
created: 2026-06-10T03:55:00Z
updated: 2026-06-10T17:57:03Z
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
- [x] `t new <type> "<title>"` scaffolds a ticket: mints the id via next-id, filename = id, complete valid frontmatter, section skeleton — prose body stays manual (Edit). Kills the T039-T043 placeholder-text failure class.
- [x] Write-time structure lint in ingest-data: malformed frontmatter on a store file warns (named field, fail-open — never blocks the write).
- [x] `t status` enforces config.statuses flow + human_only guard; auto History line; index regen + cache ingest in the same invocation.
- [x] `t status <id> done` honors `config.uat` (KIT-D034): agent-callable when uat resolves `none` for the ticket (project default + frontmatter override); requires `--human` when `required`. The done tail (archive to tickets/archive/, fixed_commit prompt on bug/regression types) runs either way (KIT-T060 behavior absorbed).
- [x] `t tick` and `t link` implemented with id/shape validation; supersedes writes both sides.
- [x] /done command doc rewritten as a wrapper over `t status ... done --human`.
- [x] /work + /drain docs updated: status flips and criterion ticks go through `t`, prose notes stay direct-edit.
- [x] Tests: valid/invalid transitions, human_only refusal, done-tail (archive + index), tick, link both-sides, unknown id.

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
- 2026-06-10: scope extended per maintainer (CLI-vs-manual discussion): + `t new`
  scaffolding (creation was a PROVEN failure point — T039-T043 placeholder text, id
  collisions) and + write-time structure lint in ingest-data (belt = CLI, suspenders =
  lint). Boundary unchanged: prose stays manual; enforce with gates, never locks.
- 2026-06-10: SHIPPED. `scripts/t.mjs` (new) — `new`/`status`/`tick`/`link`, each a pure
  exported mutation + a CLI wrapper that refreshes the board (index-tickets, incl. supersede
  reconcile) and ingests the cache, both fail-open. `setStatus` enforces flow membership +
  human_only + uat (frontmatter `uat:` overrides config default); the `done` tail archives to
  `tickets/archive/` and demands `--fixed-commit` hygiene on bug/regression. `link supersedes`
  writes both sides + flips the loser to superseded. `lintStoreText` exported and wired into
  `hooks/ingest-data.mjs` (named warnings, never blocks). Docs: `/done` now a thin wrapper over
  `t status … done --human`; `/work` + `/drain` route status flips + ticks through `t`. Tests:
  `scripts/t.test.mjs` (43 cases) added to `npm test` — full suite green. This ticket's own
  criteria were ticked and moved to review THROUGH the new CLI (dogfood). Frontmatter-helper
  duplication across scripts (field/setField) is pre-existing; left for a consolidation pass
  (KIT-T068/T069 territory) rather than widening scope here.

## History
- [2026-06-10 13:00] (status) todo → doing (drain, M2)
- [2026-06-10 17:56] (comment) ticked: `t new <type> "<title>"` scaffolds a ticket: mints the id via next-id, filename = id, complete valid frontmatter, section skeleton — prose body stays manual (Edit). Kills the T039-T043 placeholder-text failure class.
- [2026-06-10 17:56] (comment) ticked: Write-time structure lint in ingest-data: malformed frontmatter on a store file warns (named field, fail-open — never blocks the write).
- [2026-06-10 17:56] (comment) ticked: `t status` enforces config.statuses flow + human_only guard; auto History line; index regen + cache ingest in the same invocation.
- [2026-06-10 17:56] (comment) ticked: `t status <id> done` honors `config.uat` (KIT-D034): agent-callable when uat resolves `none` for the ticket (project default + frontmatter override); requires `--human` when `required`. The done tail (archive to tickets/archive/, fixed_commit prompt on bug/regression types) runs either way (KIT-T060 behavior absorbed).
- [2026-06-10 17:56] (comment) ticked: `t tick` and `t link` implemented with id/shape validation; supersedes writes both sides.
- [2026-06-10 17:56] (comment) ticked: /done command doc rewritten as a wrapper over `t status ... done --human`.
- [2026-06-10 17:56] (comment) ticked: /work + /drain docs updated: status flips and criterion ticks go through `t`, prose notes stay direct-edit.
- [2026-06-10 17:56] (comment) ticked: Tests: valid/invalid transitions, human_only refusal, done-tail (archive + index), tick, link both-sides, unknown id.
- [2026-06-10 17:57] (status) doing → review
