---
id: KIT-D009
title: "Every item-category is atomic files in a folder, like tickets — no monolith stores"
date: 2026-06-02
---

Decided: per-project workflow data obeys the global "atomic files + by-concern
directories" rule. Each **category of items** is a folder of one-file-per-item, exactly
like `tickets/`: `decisions/` (DEC-001.md …), `questions/` (Q-001.md …), `notes/`
(N-001.md …), `inbox/` (one file per raw capture, drains into the others). The monolith
`DECISIONS.md` / `QUESTIONS.md` / `INBOX.md` are retired. The project-template SEEDS the
atomic structure — "we don't plant monolith seeds."
- Singletons stay single: `config.yml`, `SESSION.md` (one current handoff).
- **Index/view files are GENERATED from the folders by a script, never hand-maintained:**
  `tickets/INDEX.md` (board), `REGRESSIONS.md` (chains), and `ROADMAP.md` (thin sequence —
  milestones + ordered ticket refs, assembled from ticket frontmatter). Hand-maintaining
  an index over many atomic files would just rebuild the monolith.
Rejected: monolith append-files per category. Why: they violate the atomic rule, grow
unbounded, churn git on every append, and bury the per-item history/links the ticket files
now carry. Source: conversation 2026-06-02. Reorganizes the project-template + the migrated
hod data; hod's rich ROADMAP narrative is thinned as its items get ticketed.
