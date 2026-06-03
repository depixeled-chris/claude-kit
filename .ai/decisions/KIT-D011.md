---
id: KIT-D011
title: "ID scheme is <KEY>-<TYPE><NUM> — project key + type letter + number"
date: 2026-06-03
---

Decided: every `.ai/` item id is **`<KEY>-<TYPE><NUM>`**.
- **KEY** — the project key, prefixed so an id is self-describing in a cross-project rundown
  (`HOD` = hustle-or-die, `KIT` = claude-kit). New projects pick a key at init.
- **TYPE** — the store letter: `T` ticket, `D` decision, `N` note, `Q` question. (The item's
  *classification* — bug/feature/etc — stays a `type:` field; the letter is the store.)
- **NUM** — zero-padded counter (pad 3), preserved across the migration so old numbers map
  1:1 (`R045` → `HOD-T045`, `DEC-003` → `HOD-D003`, `D-010` → `KIT-D010`).
- **Format A (one structural hyphen):** `HOD-T045`, not `HOD-T-045`.

Why: the prior state mixed schemes — `R###` (no hyphen, "Request") for game tickets, `T-###`
for kit tickets, `D-###` vs `DEC-###` for decisions, `N-###` for notes. The letters meant
nothing across projects and a rundown couldn't tell you which project an id belonged to. A
project key up front fixes that; encoding the type keeps the at-a-glance "what kind of thing."
Rejected: per-project *single random letters* as keys (R/T) — they carry no meaning; rejected
folding type into a JIRA-style field — we want the type visible in the id itself.

Mechanism: `scripts/rekey-ids.mjs <repo> <KEY> --apply` renames store files and rewrites refs
across `.ai/` + `docs/` + root `*.md`. `config.yml` gains `ids.key`; `prefix` becomes
`<KEY>-T`. The commit-gate cite pattern is now `\b[A-Z]{2,}-[TDNQ]\d+\b`. Old commit-message
references keep their pre-migration strings (history is immutable) — accepted cost.

Source: conversation 2026-06-03 (maintainer: "I want to see a project prefix so it makes sense
in a status rundown").
