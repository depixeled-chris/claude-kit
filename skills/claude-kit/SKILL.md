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
  per-project state carrier (config, `inbox/`, ROADMAP, `tickets/`, `questions/`,
  `decisions/`, SESSION) that travels in git — the only reliable cross-machine handoff.
- **`user-config/`** → the per-machine layer (`statusline.sh`,
  `settings.recommended.json`, `CLAUDE.global.md`), composed into `~/.claude` by
  `bootstrap.mjs` (the plugin ships the commands/hooks/skills/agents).
- **`hooks/`** → portable **Node** enforcement hooks, installed globally but
  **opt-in-aware** (no-op unless a repo has `.ai/`). Never bash (OS-shell strings
  aren't portable; they broke on Windows).
- **`agents/`**, **`skills/`** → the shared library of **non-proprietary** generic
  agents and skills, shipped by the **plugin** (→ `~/.claude/{agents,skills}`).
- **`docs/research/`** → the cross-project knowledgebase (reference, not installed).

## The boundary (non-negotiable — this repo is public + MIT)
Only **non-proprietary** content goes in. Product strategy, commercial scope, and
private/unlicensed dependencies stay in the **private overlay** (a private repo or
gitignored `~/.claude/private/`) that `bootstrap.mjs` composes. Secrets must not
reach MIT by construction — when unsure, it stays out.

## Driving a project (the workflow)
- **Capture** ideas/bugs/questions via `cap` (lands in `.ai/inbox/`, one file per
  item — fast, no interruption).
- **Interject while working** → classify against `.ai/config.yml`, route, one-line
  receipt, keep going. Block only when `config.yml` says so or the user says stop.
- **Triage** (`/triage`) drains `inbox/` → `tickets/`/`questions/`/`decisions/`.
  **Work** a ticket (`/work T-NNN`): restate acceptance criteria, confirm scope,
  execute, tick boxes, set `review` (or `done` when `config.uat: none`). **Drain**
  (`/drain`) the next item between tickets automatically. **Standup** (`/standup`)
  for a mid-flight glance; **decide** (`/decide`) to batch pending decisions.
  **Flush** (`/flush`) to `.ai/SESSION.md` before any compact/clear.
- **Anti-amnesia:** the on-disk `.ai/` + git are authoritative over chat/memory.
  Recreate context from them; never assert history you can't cite. Settled
  `decisions/` stay settled — cite, don't re-debate.

## Setting up / maintaining
- New machine: install the **plugin** (`/plugin marketplace add depixeled-chris/claude-kit`
  → `/plugin install claude-kit@claude-kit` → `/reload-plugins`), then run
  `node bootstrap.mjs` once for `~/.claude/CLAUDE.md` + private overlay + statusline.
  Merge `user-config/settings.recommended.json`; add the printed `cap` alias.
- New project: `node <kit>/scripts/init-project.mjs` inside the repo, commit `.ai/`.
- Add a reusable tool: author it **here** (`hooks/`, `agents/`, `skills/`,
  `commands/`, or `docs/research/`), index it; the plugin ships it on the next
  version bump + consumer update. A recurring fix to an agent/hook is a bug to
  fix **at the source**, not per-session.
- Update everywhere: `git pull` the kit; bump `plugin.json` `version`; consumers
  run `claude plugin marketplace update claude-kit` → `claude plugin update
  claude-kit@claude-kit` → `/reload-plugins`. Re-run `node bootstrap.mjs` only if
  the CLAUDE.md or overlay composition changed.
