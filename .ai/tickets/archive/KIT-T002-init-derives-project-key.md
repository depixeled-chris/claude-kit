---
id: KIT-T002
title: init-project sets the project key (ids.key + prefix) for new projects
type: feature
status: done
priority: medium
milestone:
labels: [init, ids]
links: [KIT-D011]
files:
  - scripts/init-project.mjs
  - project-template/.ai/config.yml
created: 2026-06-03T13:30:00Z
updated: 2026-06-12T02:27:52Z
---

## Description
The ID scheme is `<KEY>-<TYPE><NUM>` (KIT-D011). The project-template ships a literal
placeholder (`key: "KEY"`, `prefix: "KEY-T"`). `init-project.mjs` should set these from the
project at adoption time so a new project gets sensible ids immediately, instead of the user
hand-editing `config.yml`.

## Acceptance Criteria
- [x] On init, `ids.key` is set to a derived key (e.g. uppercased initials/abbreviation of the
      project name) — overridable via a flag/prompt.
- [x] `ids.prefix` is set to `<KEY>-T` to match.
- [x] Existing projects are untouched (idempotent — don't clobber a key already set).
- [x] A fresh init produces a ticket id like `<KEY>-T001` with no manual config edit.

## Plan
1. Add key derivation to init-project (initials of name, e.g. hustle-or-die → HOD; allow override).
2. Write `ids.key` + `ids.prefix` into the seeded config (only when key is still the `KEY` placeholder).

## Notes
- Deferred deliberately from the KIT-D011 re-key (which fixed the two existing projects + the
  enforcement regex + templates). This makes the scheme automatic for the *next* project.
- Derivation: split name on `-`, `_`, whitespace → first letter of each word uppercased; single-word → first 3 letters; strip non-alphanumeric; fallback `PRJ`. Override: `--key=ABC` flag. Idempotency: only replaces the literal `KEY` placeholder, never clobbers a real key. Test evidence: `npm test` green — `scripts/init-project.test.mjs` 21 passed, 0 failed (full suite exit 0).

## History
- [2026-06-12 02:22] (status) todo → doing
- [2026-06-12 02:27] (comment) ticked: On init, `ids.key` is set to a derived key (e.g. uppercased initials/abbreviation of the
- [2026-06-12 02:27] (comment) ticked: `ids.prefix` is set to `<KEY>-T` to match.
- [2026-06-12 02:27] (comment) ticked: Existing projects are untouched (idempotent — don't clobber a key already set).
- [2026-06-12 02:27] (comment) ticked: A fresh init produces a ticket id like `<KEY>-T001` with no manual config edit.
- [2026-06-12 02:27] (status) doing → review
- [2026-06-12 02:27] (status) review → done
