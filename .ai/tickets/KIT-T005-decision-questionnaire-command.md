---
id: KIT-T005
title: Decision-questionnaire command — batch pending decisions into an AskUserQuestion flow, record answers to the decisions store
type: feature
status: review
priority: medium
milestone:
labels: [command, decisions, capture]
links: [KIT-T004]
aka: [decision questionnaire, /decide]
files:
  - commands/decide.md
created: 2026-06-03T15:10:00Z
updated: 2026-06-03T15:10:00Z
---

## Description
A reusable slash command (working name `/decide`) that walks the maintainer through pending
decisions as a structured questionnaire instead of ad-hoc prose. Gathers open decision points —
from a research doc's "Decisions needed" section (e.g. the A–D pattern in
`docs/research/rust-core-migration.md`), the `.ai/questions/` queue, and/or `decisions` marked
pending — presents them via the harness AskUserQuestion tool (recommended option first, labelled),
captures the answers, and records each as an atomic file in the `decisions` store with the
maintainer's choice + rationale.

Requested by the maintainer 2026-06-03 (HOD session). It surfaced *because* a multi-decision
review (the Rust-migration A–D forks) was being done by hand; the command makes that repeatable.

## Acceptance Criteria
- [x] `commands/decide.md` — opt-in-aware (no-ops without `.ai/`), like the other claude-kit commands.
- [x] **Source pending decisions** from: (a) a named research doc's "Decisions needed" section,
      (b) `.ai/questions/` items routed for maintainer, (c) any `decisions` file marked pending.
      Accept an explicit doc/path arg to scope it.
- [x] **Present** via AskUserQuestion: one question per decision, options from the doc, the
      recommendation listed FIRST and tagged "(Recommended)". Batch to the per-call limit (4); loop.
- [x] **Record** each answer as an atomic file in the `decisions` store, id auto-allocated via
      the next-ID mechanism (`scripts/next-id.mjs decisions` — landed under KIT-T009; the
      KIT-T004 dependency is satisfied). Capture: decision, chosen option, why, source doc, date.
- [x] **Receipt** per the config receipts convention (one line per recorded decision).
- [x] Leaves the research doc's recommendation intact; never edits ROADMAP. If an answer
      contradicts a recommendation, record the answer verbatim and note the divergence.
- [x] Handle the maintainer choosing "Other"/free-text per option — record the custom text.

## Notes
- 2026-06-03: Built `commands/decide.md`. The next-ID dependency (KIT-T004) was satisfied
  early by `scripts/next-id.mjs` (KIT-T009), so this unblocked. It's a command (agent-followed
  prompt), so the "test" is invocation; argument-hint quoted (the cap.md YAML lesson).

## Notes
- 2026-06-03: Captured. This request was itself un-logged for an entire session before being
  filed — the motivating example for the request-capture ratchet (KIT, design pending). Build
  order: the ratchet + centralized next-ID (KIT-T004) ideally land first, since this command
  both *consumes* cheap ID allocation and *is* a capture surface.
- Open: command name (`/decide` vs `/decisions` vs `/questionnaire`); whether it also drains
  `.ai/questions/` or stays decisions-only.
