---
id: KIT-T002
title: init-project sets the project key (ids.key + prefix) for new projects
type: feature
status: todo
priority: medium
milestone:
labels: [init, ids]
links: [KIT-D011]
files:
  - scripts/init-project.mjs
  - project-template/.ai/config.yml
created: 2026-06-03T13:30:00Z
updated: 2026-06-03T13:30:00Z
---

## Description
The ID scheme is `<KEY>-<TYPE><NUM>` (KIT-D011). The project-template ships a literal
placeholder (`key: "KEY"`, `prefix: "KEY-T"`). `init-project.mjs` should set these from the
project at adoption time so a new project gets sensible ids immediately, instead of the user
hand-editing `config.yml`.

## Acceptance Criteria
- [ ] On init, `ids.key` is set to a derived key (e.g. uppercased initials/abbreviation of the
      project name) — overridable via a flag/prompt.
- [ ] `ids.prefix` is set to `<KEY>-T` to match.
- [ ] Existing projects are untouched (idempotent — don't clobber a key already set).
- [ ] A fresh init produces a ticket id like `<KEY>-T001` with no manual config edit.

## Plan
1. Add key derivation to init-project (initials of name, e.g. hustle-or-die → HOD; allow override).
2. Write `ids.key` + `ids.prefix` into the seeded config (only when key is still the `KEY` placeholder).

## Notes
- Deferred deliberately from the KIT-D011 re-key (which fixed the two existing projects + the
  enforcement regex + templates). This makes the scheme automatic for the *next* project.
