---
id: KIT-D037
title: "## Notes = prose narrative; ## History = structured timestamped events"
date: 2026-06-12
supersedes:
source: maintainer questionnaire 2026-06-12; governs KIT-T068
links: [KIT-T068]
---

**Decision:** Every ticket carries TWO append-only sections that serve different purposes
and are edited by different means:

- **`## Notes`** — prose/narrative progress log, direct-edit (no CLI required). Free-form
  running commentary: context, blockers, research findings, why a tradeoff was made. Any
  agent or the maintainer can append a paragraph or a bullet; no format enforced.

- **`## History`** — structured event log, stamped by the `t` CLI. One line per event,
  oldest first, format: `- [YYYY-MM-DD HH:MM] (event) detail`. Events: `created | status |
  comment | decision | blocker | unblocked | fixed | regressed`. Never edit or delete a
  prior line — it is the ticket's audit trail.

Both sections coexist per ticket. `t status` and `t tick` append to History; prose goes in
Notes by hand. Templates carry both.

**Why:** Prior templates diverged — the repo `_TEMPLATE.md` had Notes but no History; the
project-template `_TEMPLATE.md` had History but no Notes. Commands said "append to Notes"
without distinguishing the two purposes. The split-brain caused the sections to serve
overlapping roles inconsistently across projects.

**Rejected:**
- **Notes-only (fold History into Notes):** loses the machine-readable structured trail that
  `t` stamps and future tooling could parse.
- **History-only (fold Notes into History):** forces all prose into the structured one-line
  format, which discourages narrative context that isn't easily event-shaped.
