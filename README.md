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
   `.ai/inbox/` (one file per capture). Sub-second, no interruption. Already
   handled it? `cap --done "fixed login crash"` (or `cap --done bug "..."`)
   logs it as a resolved event in `.ai/resolved/` — audit trail without triage
   debt. The inbox stays clean: inbox = open work only.
2. **Interject while Claude works** — it classifies, routes, and gives a
   one-line receipt, then keeps going. Blocking is the exception (scope change,
   a regression from the current edit, or you saying "stop").
3. **Triage** drains `inbox/` into `tickets/` (a file-based kanban) — every item
   category (`tickets/ decisions/ questions/ notes/`) is a folder of one-file-per-item.
4. **Work** a ticket: `/work KIT-T001` → restate acceptance criteria → confirm
   scope → execute, ticking boxes.
5. **Drain** keeps going between tickets without being asked.
6. **Flush** before any compact/clear writes state to `.ai/SESSION.md`.
7. **Recurring obligations** ("cut a weekly release so CI caches stay warm")
   live in `.ai/reminders/` — `rem add "..." --every 7`. SessionStart surfaces
   each one when due, with its `rem done` command inline; state is git-synced
   (`last_done` in frontmatter, not mtime). See `.ai/reminders/README.md`.

The taxonomy (types, priorities, statuses, routing, drain rules) is **all
config** — `.ai/config.yml`. Add a classification or change a workflow with a
one-file edit; no code changes.

## Layout

```
claude-kit/                     # public plugin + marketplace (MIT)
├── .claude-plugin/             # plugin.json + marketplace.json — makes it installable
├── commands/                   # /cap /decide /done /drain /flush /prime /standup /triage /work
├── agents/                     # researcher, code-reviewer, refactorer, test-author
├── skills/                     # claude-kit, release-checklist, doc-audit
├── hooks/                      # Node enforcement hooks + hooks.json (plugin wiring) + lib.mjs
├── scripts/                    # .mjs scripts: cap, check-ids, code-graph, db-cache, db-engine,
│                               #   db-parse, dev-link, hydrate-db, id-utils, index-tickets,
│                               #   init-project, next-id, q, reconcile-supersede, rekey-ids, rem,
│                               #   survey, sync-tasks, t, test-hooks, treesitter, triage, …
├── user-config/                # statusline, settings.recommended.json, CLAUDE.global.md (base)
├── project-template/           # scaffolded into a repo by init-project
│   ├── .ai/                    # config.yml + atomic stores: tickets/ decisions/ questions/
│   │                           #   notes/ inbox/ reminders/ (+ archive/) + SESSION.md; ROADMAP.md generated
│   └── CLAUDE.snippet.md       # the behavioral contract
├── docs/STRATEGY.md            # the full model and the why
└── bootstrap.mjs               # cross-platform installer (Win/mac/Linux): CLAUDE.md +
                                #   private overlay (what a plugin can't). bootstrap.sh is a
                                #   thin POSIX wrapper. LINK_TOOLING=1 also symlinks tooling.
```

## Install — two mechanisms, one rule

claude-kit installs in **two complementary** parts. They do **not** overlap, and you must
not install the **tooling** twice (KIT-D013):

| What | Installed by | Notes |
| --- | --- | --- |
| **Tooling** — commands, hooks, skills, agents | the **plugin** (canonical) | auto-wired via `hooks/hooks.json`; nothing to symlink |
| **`~/.claude/CLAUDE.md`** + **private overlay** + statusline | **`bootstrap.mjs`** | a plugin can't write `~/.claude/CLAUDE.md` or pull in your private overlay |

> ⚠️ **The rule:** install the tooling **once**. Use the **plugin** (recommended) **or**
> `LINK_TOOLING=1 node bootstrap.mjs` (legacy non-plugin install) — **never both**. Running
> both symlinks the same hooks/commands the plugin already provides, so every hook fires
> twice and commands appear twice. This is the failure KIT-D013 exists to prevent.

### 1. Tooling — install the plugin (recommended)

From any Claude Code session:

```
/plugin marketplace add depixeled-chris/claude-kit
/plugin install claude-kit@claude-kit       # plugin@marketplace
/reload-plugins                              # apply without restarting
```

The `orient` hook then snaps each session into the workflow automatically in any adopted
repo (one with `.ai/`); `/prime` re-snaps on demand. **Requires Node on `PATH`** (the
hooks are Node).

### 2. CLAUDE.md + private overlay — run bootstrap (even with the plugin)

The plugin can't install your global `~/.claude/CLAUDE.md` contract or your private
overlay, so run bootstrap once for those — by default it does **not** touch the tooling:

```bash
git clone <this-repo> ~/Documents/code/claude-kit   # or wherever
cd ~/Documents/code/claude-kit
node bootstrap.mjs                                   # CLAUDE.md + overlay + statusline only
```
`bootstrap.mjs` is the cross-platform installer (Windows, macOS, Linux — Node is already
required). On a POSIX shell `./bootstrap.sh` still works (it's a thin wrapper that calls
`node bootstrap.mjs`). Then add the printed `cap` shortcut to your shell profile. (No
`settings.json` hook wiring needed — the plugin wires the hooks.)

**Not using the plugin?** Do the legacy full symlink install instead, and wire the hooks
yourself:
```bash
LINK_TOOLING=1 node bootstrap.mjs                    # also symlinks commands/hooks/skills/agents
# then merge user-config/settings.recommended.json into ~/.claude/settings.json
```

For the centralized data model (KIT-D008), set `CLAUDE_DATA` to your `claude-kit-data`
clone and run `init-project` per repo (below).

### 3. Per project
```bash
cd /path/to/your/repo
node ~/Documents/code/claude-kit/scripts/init-project.mjs
```
With `CLAUDE_DATA` set (the centralized model, KIT-D008), this writes a `.claude-project`
pointer and links `.ai/` as a gitignored junction into `$CLAUDE_DATA/projects/<name>/`.
Without `CLAUDE_DATA`, it scaffolds `.ai/` **inside** the repo (committed there) — the
simpler per-repo mode.

### 4. Cache-hydration git hooks — per clone, **per machine** (KIT-T097)

The derived SQLite cache hydrates on every in-process item write (KIT-T096) **and** on
`git pull` / `checkout` / `rebase`, so a pull of `claude-kit-data` from another machine
refreshes the cache the moment it lands. The pull-side half attaches via
`git config core.hooksPath <kit>/.githooks` — **local, per-clone config that is NOT
committed**. So it must be installed **once per clone, on each machine**:

```bash
node <kit>/scripts/install-git-hooks.mjs /path/to/claude-kit-data   # the high-leverage one (all centralized projects)
node <kit>/scripts/install-git-hooks.mjs /path/to/claude-kit        # the kit's own .ai
# + any local-mode project repo whose .ai/ lives in-repo
```

`init-project` runs this automatically for **new** adoptions. **Existing** clones on a
second machine (e.g. your macOS `claude-kit-data` + `claude-kit`) need the one-time run
above — running it on the Windows box does **not** configure the Mac's clone. The installer
is idempotent and **guards**: it warns and skips if a repo already sets `core.hooksPath` or
has its own `.git/hooks` (it won't clobber husky etc.).

The `PostToolUse(Bash)` complement (`git-pull-hydrate.mjs`) ships with the **plugin**, so it
needs no install and covers **agent-run** pulls on every machine; the native hooks above add
the **manual terminal** pulls. (`git reset --hard` fires no git hook — that residual falls to
the read-time self-heal audit.)

## What syncs where

- **Workflow data** lives in one private repo, **`claude-kit-data`** (KIT-D008): a
  `projects/<name>/` per project (its `tickets/ decisions/ …`) plus the private
  `overlay/`. A project repo holds only a `.claude-project` pointer and a gitignored
  `.ai` junction into it. Syncing that **one** repo carries every project's state across
  machines; the `sync-data` hook auto-commits it. *(Per-repo mode instead commits `.ai/`
  in the project itself.)*
- **Tooling** (commands, hooks, skills, agents) ships as the **plugin** — installed once
  per machine; nothing to hand-sync. Do **not** also symlink it via bootstrap (KIT-D013).
- **`~/.claude/CLAUDE.md` + private overlay + statusline** are installed by `bootstrap.mjs`
  (the plugin can't reach them) — the one part you run per machine alongside the plugin.
- **Secrets / proprietary config** live in the private overlay, never in this public repo.

## Private overlay (keep secrets out of the public kit)

This repo is public + MIT, so it holds **non-proprietary content only**. Anything
sensitive — personal `CLAUDE.md` rules, proprietary agents/commands/skills/hooks —
lives in a separate **private overlay** that `bootstrap.mjs` composes on top. The
boundary is structural: secrets can't reach the MIT repo because they're authored
somewhere else.

`bootstrap.mjs` resolves the overlay in this order, and skips it if none is found:

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
global file. Preview any run with `DRY_RUN=1 node bootstrap.mjs`.

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
