---
id: KIT-D008
title: "Centralize workflow DATA in a private repo; project repos hold only a pointer"
date: 2026-06-02
---

Decided: split tooling from data across two repos.
- **claude-kit** (public, MIT) = tooling ONLY (hooks, commands, skills, agents, templates,
  scripts, docs).
- **claude-kit-data** (private) = ALL workflow data for ALL projects, centralized:
  `projects/<name>/` each holding ROADMAP / DECISIONS / SESSION / INBOX / QUESTIONS /
  tickets (+ archive) / INDEX / REGRESSIONS, plus the KIT-D002 private `overlay/`.
A project repo houses NO workflow content — only a one-line `.claude-project` pointer; its
`.ai/` becomes a gitignored symlink/junction to `$CLAUDE_DATA/projects/<name>/`, so existing
`.ai/`-reading tooling keeps working unchanged.
Why (maintainer): (1) invoke the system from anywhere, not only inside a project repo; (2)
standardization — every project identical, in one place; (3) backups — one private repo to
sync, replacing per-repo `.ai/` syncing.
Supersedes: STRATEGY "cross-machine model: `.ai/` rides the project repo (the only reliable
carrier)" — for a solo/private line a single central private repo is the better carrier.
Folds in KIT-D002: the private overlay lives in `claude-kit-data/overlay/`.
Trade-off (surfaced, accept knowingly): the atomic "work + its log in the SAME commit"
property (the three absolutes; commit-gate enforced) breaks across two repos. The gate
degrades to **cite-only** in the project repo; claude-kit-data is committed separately —
auto-committed on ticket/history change (a hook) to keep it ~atomic.
Owed: design the resolution mechanism + the gate change + the migration (move hod `.ai/` →
`claude-kit-data/projects/hustle-or-die/`, including the ROADMAP `R###` → ticket-format
migration) WITH the maintainer before building. Source: conversation 2026-06-02.
