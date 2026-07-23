---
id: KIT-T152
title: Project display title + details in a project-level markdown file (.ai/PROJECT.md) — extrapolated by default, synced across devices
type: feature
status: todo
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-T131, KIT-T149, KIT-T134]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:56:12Z
updated: 2026-07-23T18:56:12Z
---

## Description
Maintainer request 2026-07-23: the project display title must be (1) EXTRAPOLATED by
default — no manual setup for a usable name — and (2) live in a MARKDOWN FILE at the
project level alongside other project details, so it persists across sessions AND
devices. Today the display name comes from the machine registry / directory name —
machine-local state, invisible cross-device (the exact failure class KIT-T134 fixed
for tickets).

OVERLAP NOTE (reconciled 2026-07-23): KIT-T137 (parallel session) already ships a
UI-editable display_name in .ai/config.yml. THIS ticket is the delta: extrapolated
DEFAULT (never an empty/dir-name label), the richer PROJECT.md details file, DTO
description, and adoption/backfill seeding. The T137 config.yml line remains the
title's write target unless PROJECT.md supersedes it here — decide at implementation,
one source of truth, no dual write.

Design: `.ai/PROJECT.md` — frontmatter (displayTitle, description, repoUrl, tags) +
free prose body for project details. It rides the store's existing sync (in-repo .ai
commits or the central-notebook junction), so every device sees it. Extrapolation:
when the file or its displayTitle is absent, derive from the project name
("hustle-or-die" → "Hustle or Die") at READ time, and SEED the file at adoption
(init-project) + backfill via reconcile-central so the derived title becomes durable,
editable truth rather than a recomputation. API: the project DTO gains
displayTitle/description sourced from PROJECT.md; UI headers/sections/selector show
displayTitle (key stays in parens per KIT-T144's convention).

## Acceptance Criteria
- [ ] .ai/PROJECT.md schema defined + seeded at adoption (init-project) with the extrapolated title; existing projects backfilled by a reconcile pass or lazily on first API read
- [ ] Reader with fallback chain: PROJECT.md displayTitle → derived-from-name — never an empty label; shared module used by API + survey (one source of truth)
- [ ] API project DTOs expose displayTitle + description; UI (waiting board, /all section heads, project selector, board headers) renders displayTitle (KEY)
- [ ] Cross-device proof: the file lives under .ai/ and syncs like every other store artifact (test: central-notebook project resolves the same title)
- [ ] Tests for extrapolation + fallback; ui build + full npm test green

## Plan
1. PROJECT.md reader/derive module in scripts/ (beside frontmatter.mjs).
2. Seed in init-project + reconcile; API DTO + UI wiring.
3. Tests; ui:build for the live server.

## History
- [2026-07-23 18:56] (created) feature — Project display title + details in a project-level markdown file (.ai/PROJECT.md) — extrapolated by default, synced across devices
