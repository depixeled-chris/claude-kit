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
   `.ai/INBOX.md`. Sub-second, no interruption.
2. **Interject while Claude works** — it classifies, routes, and gives a
   one-line receipt, then keeps going. Blocking is the exception (scope change,
   a regression from the current edit, or you saying "stop").
3. **Triage** drains INBOX into `.ai/tickets/` (a file-based kanban).
4. **Work** a ticket: `/work T-001` → restate acceptance criteria → confirm
   scope → execute, ticking boxes.
5. **Drain** keeps going between tickets without being asked.
6. **Flush** before any compact/clear writes state to `.ai/SESSION.md`.

The taxonomy (types, priorities, statuses, routing, drain rules) is **all
config** — `.ai/config.yml`. Add a classification or change a workflow with a
one-file edit; no code changes.

## Layout

```
claude-kit/
├── README.md
├── bootstrap.sh            # wire into a machine (symlinks commands + statusline)
├── docs/
│   ├── STRATEGY.md         # the full model and the why
│   ├── DAILY-LOOP.md       # one-page cheat sheet
│   └── GLOSSARY.md         # plain-English Claude Code internals
├── user-config/            # the per-machine layer (→ ~/.claude)
│   ├── commands/           # /prime /cap /triage /work /flush
│   ├── statusline.sh
│   └── settings.recommended.json
├── project-template/       # the per-project layer (→ any repo's .ai/)
│   ├── .ai/                # config.yml, INBOX, ROADMAP, tickets/, QUESTIONS, DECISIONS, SESSION
│   └── CLAUDE.snippet.md   # the behavioral contract
└── scripts/
    ├── cap.mjs             # fast capture
    └── init-project.mjs    # scaffold .ai/ into a repo
```

## Install (as a plugin) — works from anywhere

claude-kit is a Claude Code **plugin + marketplace**. Install once and the commands,
hooks (orient / commit-gate / flush / quality / data-sync), skills, and agents are
available in **every** session on that machine — no symlinking, no per-repo wiring. From
any Claude Code session:

```
/plugin marketplace add depixeled-chris/claude-kit
/plugin install claude-kit
```

The `orient` hook then snaps each session into the workflow automatically in any adopted
repo (one with `.ai/`); `/prime` re-snaps on demand. **Requires Node on `PATH`** (the
hooks are Node). For the centralized data model (D-008), also set `CLAUDE_DATA` to your
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
This drops in `.ai/`, appends the contract to `CLAUDE.md`, and guards
`.gitignore`. Commit `.ai/` — it's your cross-machine state carrier.

## What syncs where

- **Project state** (`.ai/`) travels in the **project repo** — the only reliable
  cross-machine carrier. Auto-memory and native tasks are machine-local; never
  rely on them for handoff.
- **Machine config** (commands, statusline, skills, agents, hooks) travels in
  **this repo**, symlinked into `~/.claude` by `bootstrap.sh`.
- **Secrets / proprietary config** travel in a **private overlay** — never here.

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

See `docs/STRATEGY.md` for the full reasoning and `docs/DAILY-LOOP.md` to start.
