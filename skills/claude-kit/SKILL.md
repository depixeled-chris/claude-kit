---
name: claude-kit
description: Manage work and tooling through the claude-kit repo — the canonical, cross-machine source of truth for the Claude Code workflow (.ai/ capture→triage→work→drain→flush), enforcement hooks, and the shared inventory of generic commands, hooks, agents, and skills. Use when setting up a project, driving the backlog, or adding/maintaining anything broadly reusable across projects.
---

# claude-kit — managing work and tooling

claude-kit is the **single source of truth** for everything reusable across
projects. Author tooling here; machines and projects consume it. Never maintain
the same thing in two places.

## What lives where
- **`project-template/.ai/`** → scaffolded into a repo by `init-project`. The
  per-project state carrier (config, INBOX, ROADMAP, tickets/, QUESTIONS,
  DECISIONS, SESSION) that travels in git — the only reliable cross-machine handoff.
- **`user-config/`** → the per-machine layer (`commands/`, `statusline.sh`,
  `settings.recommended.json`), installed into `~/.claude` by `bootstrap.sh`.
- **`hooks/`** → portable **Node** enforcement hooks, installed globally but
  **opt-in-aware** (no-op unless a repo has `.ai/`). Never bash (OS-shell strings
  aren't portable; they broke on Windows).
- **`agents/`**, **`skills/`** → the shared library of **non-proprietary** generic
  agents and skills, installed into `~/.claude/{agents,skills}`.
- **`research/`** → the cross-project knowledgebase (reference, not installed).

## The boundary (non-negotiable — this repo is public + MIT)
Only **non-proprietary** content goes in. Product strategy, commercial scope, and
private/unlicensed dependencies stay in the **private overlay** (a private repo or
gitignored `~/.claude/private/`) that `bootstrap.sh` composes. Secrets must not
reach MIT by construction — when unsure, it stays out.

## Driving a project (the workflow)
- **Capture** ideas/bugs/questions to `.ai/INBOX.md` (fast, no interruption).
- **Interject while working** → classify against `.ai/config.yml`, route, one-line
  receipt, keep going. Block only when `config.yml` says so or the user says stop.
- **Triage** drains INBOX → `.ai/tickets/`. **Work** a ticket: restate acceptance
  criteria, confirm scope, execute, tick boxes, set `review` (never `done` — that's
  human-only). **Drain** the next item between tickets. **Flush** to `.ai/SESSION.md`
  before any compact/clear.
- **Anti-amnesia:** the on-disk `.ai/` + git are authoritative over chat/memory.
  Recreate context from them; never assert history you can't cite. Settled
  `DECISIONS` stay settled — cite, don't re-debate.

## Setting up / maintaining
- New machine: `git clone` the kit, run `./bootstrap.sh`, merge
  `user-config/settings.recommended.json`, add the printed `cap` alias.
- New project: `node <kit>/scripts/init-project.mjs` inside the repo, commit `.ai/`.
- Add a reusable tool: author it **here** (`hooks/`, `agents/`, `skills/`,
  `commands/`, or `research/`), index it, then `bootstrap.sh` installs it. A
  recurring fix to an agent/hook is a bug to fix **at the source**, not per-session.
- Update everywhere: `git pull` the kit; re-run `bootstrap.sh` if wiring changed.
