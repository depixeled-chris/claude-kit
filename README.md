# claude-kit

A repeatable Claude Code workflow: capture fast, defer by default, drain
automatically, and never lose context to compaction. One reference repo you
clone onto any machine — including a clean box with nothing but a fresh Claude
Code install.

## The problem it solves

Two natures at odds. Chris reacts and rides a stream of consciousness. Claude
context-switches well but needs stable, already-litigated context to work
without interruption. The kit is the impedance match:

- **Your job becomes pure capture** — fire ideas/bugs/questions and trust
  they're filed in the right place.
- **Claude's job becomes drain-and-execute** against a stable backlog with
  settled decisions, surfacing only what genuinely needs you.

And because state lives in **files, not the chat buffer**, compaction can't
round it off and a fresh session resumes cold.

## How it works (one minute)

1. **Capture** anything, anytime: `cap bug login loops after SSO`. Lands in
   `.ai/inbox/` (one file per capture). Sub-second, no interruption.
2. **Interject while Claude works** — it classifies, routes, and gives a
   one-line receipt, then keeps going. Blocking is the exception (scope change,
   a regression from the current edit, or you saying "stop").
3. **Triage** drains `inbox/` into `tickets/` (a file-based kanban) — every item
   category (`tickets/ decisions/ questions/ notes/`) is a folder of one-file-per-item.
4. **Work** a ticket: `/work KIT-T001` → restate acceptance criteria → confirm
   scope → execute, ticking boxes.
5. **Drain** keeps going between tickets without being asked.
6. **Flush** before any compact/clear writes state to `.ai/SESSION.md`.

The taxonomy (types, priorities, statuses, routing, drain rules) is **all
config** — `.ai/config.yml`. Add a classification or change a workflow with a
one-file edit; no code changes.

## Layout

```
claude-kit/                     # public plugin + marketplace (MIT)
├── .claude-plugin/             # plugin.json + marketplace.json — makes it installable
├── commands/                   # /prime /cap /triage /work /flush
├── agents/                     # researcher, code-reviewer, refactorer, test-author
├── skills/                     # claude-kit, release-checklist, doc-audit
├── hooks/                      # Node enforcement hooks + hooks.json (plugin wiring) + lib.mjs
├── scripts/                    # cap, init-project, index-tickets, sync-tasks, test-hooks
├── user-config/                # statusline, settings.recommended.json, CLAUDE.global.md (base)
├── project-template/           # scaffolded into a repo by init-project
│   ├── .ai/                    # config.yml + atomic stores: tickets/ decisions/ questions/
│   │                           #   notes/ inbox/ (+ archive/) + SESSION.md; ROADMAP.md generated
│   └── CLAUDE.snippet.md       # the behavioral contract
├── docs/STRATEGY.md            # the full model and the why
└── bootstrap.sh                # alternative non-plugin install (symlinks into ~/.claude)
```

## Install (as a plugin) — works from anywhere

claude-kit is a Claude Code **plugin + marketplace**. Install once and the commands,
hooks (orient / commit-gate / flush / quality / data-sync), skills, and agents are
available in **every** session on that machine — no symlinking, no per-repo wiring. From
any Claude Code session:

```
/plugin marketplace add depixeled-chris/claude-kit
/plugin install claude-kit@claude-kit       # plugin@marketplace
/reload-plugins                              # apply without restarting
```

The `orient` hook then snaps each session into the workflow automatically in any adopted
repo (one with `.ai/`); `/prime` re-snaps on demand. **Requires Node on `PATH`** (the
hooks are Node). For the centralized data model (KIT-D008), also set `CLAUDE_DATA` to your
`claude-kit-data` clone and run `init-project` per repo.

## Setup (alternative: symlink install via bootstrap)

**This machine / a new machine:**
```bash
git clone <this-repo> ~/Documents/code/claude-kit   # or wherever
cd ~/Documents/code/claude-kit
./bootstrap.sh                                       # links commands + statusline, prints the cap alias
```
Then add the printed `cap` alias to your shell rc and merge
`user-config/settings.recommended.json` into `~/.claude/settings.json`.

**A project:**
```bash
cd /path/to/your/repo
node ~/Documents/code/claude-kit/scripts/init-project.mjs
```
With `CLAUDE_DATA` set (the centralized model, KIT-D008), this writes a `.claude-project`
pointer and links `.ai/` as a gitignored junction into `$CLAUDE_DATA/projects/<name>/`.
Without `CLAUDE_DATA`, it scaffolds `.ai/` **inside** the repo (committed there) — the
simpler per-repo mode.

## What syncs where

- **Workflow data** lives in one private repo, **`claude-kit-data`** (KIT-D008): a
  `projects/<name>/` per project (its `tickets/ decisions/ …`) plus the private
  `overlay/`. A project repo holds only a `.claude-project` pointer and a gitignored
  `.ai` junction into it. Syncing that **one** repo carries every project's state across
  machines; the `sync-data` hook auto-commits it. *(Per-repo mode instead commits `.ai/`
  in the project itself.)*
- **Tooling** (commands, hooks, skills, agents) ships as the **plugin** — installed once
  per machine; nothing to hand-sync.
- **Secrets / proprietary config** live in the private overlay, never in this public repo.

## Private overlay (keep secrets out of the public kit)

This repo is public + MIT, so it holds **non-proprietary content only**. Anything
sensitive — personal `CLAUDE.md` rules, proprietary agents/commands/skills/hooks —
lives in a separate **private overlay** that `bootstrap.sh` composes on top. The
boundary is structural: secrets can't reach the MIT repo because they're authored
somewhere else.

`bootstrap.sh` resolves the overlay in this order, and skips it if none is found:

1. `$CLAUDE_KIT_PRIVATE` — a private repo clone (or any directory)
2. `~/.claude/private/` — gitignored
3. none — public kit only

The overlay mirrors the kit's installable layout (flat), all parts optional:

```
<overlay>/
├── commands/*.md          agents/*.md          skills/*/          hooks/*.mjs
├── statusline.sh          # overrides the public statusline
├── CLAUDE.md              # personal/proprietary global rules
└── settings.private.json  # merged after settings.recommended.json
```

Overlay items are linked **after** the public ones, so a private item of the same
name **wins** — the private layer overrides the public, never the reverse.
`~/.claude/CLAUDE.md` is composed from an optional public base
(`user-config/CLAUDE.global.md`) plus the overlay's `CLAUDE.md`; composition stays
dormant until at least one source exists, so it won't clobber a hand-maintained
global file. Preview any run with `DRY_RUN=1 ./bootstrap.sh`.

## Developing & shipping the plugin

The runtime reads an installed *copy*, not this repo — so there are two distinct loops.
Don't run the publish loop on every edit.

**Inner loop — fast, no install, no session impact:**
- `npm test` → `scripts/test-hooks.mjs` runs every hook against mock payloads in
  throwaway git fixtures and asserts exit codes. Run before every push.
- `claude plugin validate .` checks the plugin + marketplace manifests.

**Dev loop — live in your session, one command:** run `node scripts/dev-link.mjs` **once**
to point the installed plugin at this working repo (junction). After that the entire loop
is: **edit the repo → `/reload-plugins`.** No marketplace update, no version bump, no
reinstall. (`node scripts/dev-link.mjs --unlink` restores the frozen snapshot.)

**Publish loop — occasional, for *other* machines / consumers:**
1. `npm test` green; **bump `.claude-plugin/plugin.json` `version`** (required — `/plugin
   update` is version-gated; no bump ships nothing).
2. `claude plugin tag` (tags the release, verifies plugin.json + marketplace agree).
3. Commit + push.
4. Consumers: `claude plugin marketplace update claude-kit` → `claude plugin update
   claude-kit@claude-kit` (or the `/plugin …` equivalents) → restart/`/reload-plugins`.

See `docs/STRATEGY.md` for the full reasoning and `docs/DAILY-LOOP.md` to start.
