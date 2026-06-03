---
id: KIT-T005
title: Decision-questionnaire command — batch pending decisions into an AskUserQuestion flow, record answers to the decisions store
type: feature
status: todo
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
- [ ] `commands/decide.md` — opt-in-aware (no-ops without `.ai/`), like the other claude-kit commands.
- [ ] **Source pending decisions** from: (a) a named research doc's "Decisions needed" section,
      (b) `.ai/questions/` items routed for maintainer, (c) any `decisions` file marked pending.
      Accept an explicit doc/path arg to scope it.
- [ ] **Present** via AskUserQuestion: one question per decision, options from the doc, the
      doc's recommendation listed FIRST and tagged "(Recommended)". Batch up to the tool's
      per-call limit; loop for more.
- [ ] **Record** each answer as an atomic file in the `decisions` store using the project's
      key+prefix (ids.key), id auto-allocated via the next-ID mechanism (depends on [[KIT-T004]] /
      whichever centralizes ID assignment — do NOT dir-scan). Capture: decision, chosen option,
      why, source doc, date.
- [ ] **Receipt** per the config receipts convention (one line per recorded decision).
- [ ] Leaves the research doc's recommendation intact; never edits ROADMAP (mirrors the
      researcher-agent boundary). If an answer contradicts a recommendation, record the answer
      verbatim and note the divergence.
- [ ] Handle the maintainer choosing "Other"/free-text per option — record the custom text.

## Notes
- 2026-06-03: Captured. This request was itself un-logged for an entire session before being
  filed — the motivating example for the request-capture ratchet (KIT, design pending). Build
  order: the ratchet + centralized next-ID (KIT-T004) ideally land first, since this command
  both *consumes* cheap ID allocation and *is* a capture surface.
- Open: command name (`/decide` vs `/decisions` vs `/questionnaire`); whether it also drains
  `.ai/questions/` or stays decisions-only.
