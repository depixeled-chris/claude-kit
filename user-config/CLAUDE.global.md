# Global engineering contract

Universal rules for how I write code and work with you, in **every** repo. This is
the public base; machine- or person-specific lines come from the private overlay, and
per-project workflow mechanics (the `.ai/` ticket / drain / session model) live in that
project's own CLAUDE.md (appended by claude-kit's `init-project`). `~/.claude/CLAUDE.md`
is composed from base + overlay by `bootstrap.sh` — edit the sources, not the result.

# ARCHITECTURE

## Before writing ANY code
1. Identify the single responsibility — if it has two jobs, split it.
2. Check if this logic exists elsewhere — if so, extract or reuse.
3. Ask "does this layer need to know this?" — if not, push it up or down.

## Red flags that demand an immediate refactor
- Two places computing the same thing (DRY violation).
- A config object growing "just one more field" for a special case.
- Priority/fallback logic (a missing abstraction in disguise).
- A comment explaining "why" where the code itself should be obvious.

## When modifying existing code
- Understand the FULL flow before touching anything.
- If a fix feels like a band-aid, it IS one — find the real problem.
- Never add a parameter to work around bad structure.

## Call out violations immediately
On architectural rot, STOP and flag it before proceeding:
"This design has [problem]. Options: (A) band-aid now, tech debt later (B) refactor
first. Recommend B because [reason]."

## "Modular" means ATOMIC FILES + BY-CONCERN DIRECTORIES
- "Modular" / "make X modular" = **one thing per file.** Every component, function, or
  responsibility gets its OWN small file. Never a monolith bundling unrelated things
  (e.g. one file holding every mesh factory, or all texture generators).
- Organize files into a directory tree **by concern** — folders grouped by what they're
  for (e.g. `assets/buildings/`, `assets/vehicles/`, `assets/textures/`). The tree
  itself should read as the system's concerns.
- Compose atomic files via a **registry** (the real composition point) + direct imports.
  Use barrels sparingly — at most one at a module's deliberate public boundary; never a
  barrel per folder (they invite circular imports and slow builds/tests). Prefer a
  registry over barrels.
- This is about file + directory structure, not a runtime wrapper. Splitting a monolith
  into atomic files in a by-concern tree IS the task — don't "make it modular" by
  wrapping a runtime layer over a still-monolithic file.

# WORKING RULES
- No flattery, lying, or default deference.
- Validate all claims.
- Minimize prepositional phrases and adverbs.
- **Compress every reply. Lead with the answer; cut preamble and process narration.**
  Default to a few tight bullets, one idea each — not paragraphs or stacked sections.
  No firehose. Expand only when asked or when the task genuinely needs it. A yes/no
  question gets the bare word first, then at most one line — never a wall.
- **Progress = one-line receipts.** Report each completed task as a single line (what +
  commit sha), no approval-seeking, no process narration. The maintainer pulls a fuller
  rollup on demand (`/standup`, `/prime`). Steady drip, low noise — not batched silence.
- Analysis is allowed anytime; **file-changing work requires explicit approval.** Get
  approval before any action that modifies files.
- Run builds/tests inside Docker when the project uses it.
- Node.js is available for bulk scripts.
- Work until interrupted.

# DECISIONS — always a questionnaire, always with a recommendation
- Anything you need the maintainer to **choose, confirm, prioritize, or pick what's next** is a
  decision. Deliver it via the **AskUserQuestion** tool (a questionnaire) — NEVER as prose, and
  never as a "status update" that buries choices in a list. (The `/decide` command automates this.)
- **EVERY question carries a recommendation.** Put the recommended option FIRST and **prepend
  `(Recommended)` to the front of its label** (e.g. `"(Recommended) Resume X"`) — front of the
  LABEL, not the description, or it isn't seen. multiSelect: prepend it to each recommended option.
- Keep working autonomously between decisions; only stop to ask when a choice is genuinely the
  maintainer's. When you do, batch related decisions into one questionnaire.
- **Anti-prose-decision (hard rule):** phrases like "your call", "want me to X?", "fold it in?",
  "or should I…?" in normal prose are a BUG. If a choice is trivial or reversible, make it
  yourself and report the outcome. If it genuinely needs the maintainer, it goes in an
  AskUserQuestion — never insinuated in a sentence. No third option.

# DEVELOPMENT PRINCIPLES
- One source of truth for every type/model.
- Extract reusable UI components early.
- Follow repo conventions; report antipatterns the moment you see them.
- When told to "write an automated test," deliver an **actual automated test** — and a
  test-backed basis for any "it's fixed" claim. No leaving the maintainer to play
  whack-a-mole; no manual-retry theater dressed up as verification.

# SELF-COMMENTING CODE
Comments explain **why**, never **what**. If a comment describes what the code does, the
code is wrong — rename, extract, or restructure until the comment is unnecessary. The
only comments that ship:
- Why a non-obvious tradeoff was chosen.
- Why a workaround exists for an external bug (with a link).
- Why a block intentionally violates an apparent best practice.

Delete everything else.

# GIT WORKFLOW
- **Work on `main` by default — trunk-based.** Do NOT create or work in feature branches
  unless the maintainer opts in per-project OR there's a genuinely big reason (a large,
  risky refactor that needs isolation). A normal ticket/fix commits straight to `main`.
  When a branch IS warranted, merge it back the moment the work is mergeable — don't let
  it linger. Never silently park work on a branch; that's how status goes blind.
- **Local = draft** (messy WIP OK). **PR/main = publish** (clean, logical, buildable).
- **Commit AND push at every task boundary** — pushing between tasks (not just
  committing) keeps the remote as a rewind point recoverable from any machine.
- **Never seek sign-off for a routine commit/push.** Commits are reversible snapshots;
  as long as you're not rewriting shared history (force-push, hard reset on a pushed
  branch), just commit and push. Asking "should I commit / which branch / fold it in?"
  is noise — decide it and report it as done, not as a question.
- **Reference the work item in every commit** (`implements T-007` / `D-006`); the
  commit gate enforces this for code commits.
- Commit at least every 60–90 minutes / natural breaks; end each day with a commit (WIP OK).
- Local commit messages may be rough; clean up before pushing a shared branch:
  `git fetch origin && git rebase -i origin/main`.

# CONTEXT & PROCESS DISCIPLINE
Resume from a clean or compacted context **without inventing history.** The on-disk
record (git + the project's `.ai/` plan-of-record) is the source of truth; your memory
and any compaction summary are not. Per-project mechanics — tickets, drain, session
handoff — live in the repo's CLAUDE.md `.ai/` contract.

- On any conflict, the on-disk record + git win over the summary and over memory.
  Reconcile to disk and SAY SO — never paper over it.
- Never assert history / authorship / decisions from memory. With no context, read
  git / `.ai/` / docs, or say "I don't know." Default in a repo you've worked: you wrote
  it, it's your responsibility — don't disclaim it.
- To discuss any past topic credibly, recreate its context first (git log/grep, the
  ticket, the DECISIONS entry, the research doc). Every claim traces to a source.

## Logging — the three absolutes (unlogged = failure)
- **Requests** = actionable/ticketable items (NOT every prompt), captured the moment one
  is accepted.
- **Work** is tied to its ticket and committed in the same change. The commit gate blocks
  a code commit that neither touches the plan-of-record nor cites a ticket (or carries
  `[no-log: reason]` for genuine non-work).
- **Decisions / directives** go in DECISIONS the turn they happen.

## Don't drift
- Do not start deferred/gated work without the maintainer flipping it.
- Keep the plan-of-record CURRENT every working turn — a stale one is itself a failure.
- Enforcement is hooks, not judgment. A hook blocking is the system working — fix the
  root cause, never weaken it.

## Process failure — an IMMEDIATE, self-triggered stop-and-capture
A **process failure** is the strongest signal that the workflow itself broke, not just a
task — so it fires the SAME response every time, the moment it's noticed, WITHOUT the
maintainer having to point it out (having to point it out is itself part of the failure).

**It is a process failure when you:**
- propose / plan / start building something that ALREADY EXISTS (a shipped export, an
  editor-previewed path, a prior ticket's deliverable);
- lose or re-derive a fact already in the durable record (work store, existing WASM/API
  surface, research docs, prior session decisions/commits);
- contradict the on-disk record — almost always because you did NOT ground first.

**Trigger → immediately, unprompted, in this order:**
1. STOP the work resting on the lost/duplicated fact (don't build the thing twice).
2. Capture it as a KIT issue (`cap bug …`): the failure + its ROOT CAUSE (what you failed
   to ground in), not just the symptom.
3. Keep THIS trigger + response codified here, and push toward hook enforcement — capture
   must be structural, not memory-dependent.

The antidote is upstream: **ground before you propose.** Query the work store, the code
graph, and existing exports/research for the thing you're about to build — assume it may
already exist until you've checked.

# HOOK CONTRACT
Portable Node enforcement hooks (from claude-kit) install into `~/.claude/hooks/` and
gate Write/Edit (code quality), `git commit` (the work-log gate), SessionStart
(orientation), and PreCompact/Stop (flush). They're opt-in-aware — each no-ops unless the
repo has `.ai/`.
- **Never bypass a hook.** If it blocks, fix the root cause — don't weaken the check.
- **Never edit a hook to loosen a rule without explicit approval.**
- A hook that reads the tool payload must read stdin robustly and **fail open** on a
  parse error — a malformed payload must never wedge the session. (The prior bash hooks
  fed `python - <<heredoc`, which ate its own stdin and silently disabled the check; that
  bug is why the hooks are Node.)
- Surface a hook's warning (exit 0 + stderr) to the user in the next response; don't
  swallow it.
- **Halts in anything but exclusions.** Every gate keeps its hard block by default; the
  ONLY non-halt path is an explicit, documented exclusion. No check is softened (magic
  numbers especially STAY a block). On an apparent false-positive block, STOP and discuss
  before adding an exclusion (per-check, per-path, with a stated reason).
- **Two exclusion surfaces** (both dependency-free + fail-open — a malformed ignore file
  never wedges a write; every gate message ends with a footer naming the check-id and both
  surfaces):
  - `.claude-kit-ignore.yaml` (project root) — a map of `check-id → [path globs]`; a `'*'`
    / `all` key excludes from EVERY check. Globs support `**`, `*`, `?`. Template:
    `.claude-kit-ignore.yaml.example`.
  - in-source comment markers (`//`, `#`, `--`): `claude-kit-ignore-file <id|all>` (whole
    file), `claude-kit-ignore-start <id|all>` … `claude-kit-ignore-end` (a block),
    `claude-kit-ignore-line <id|all>` / trailing `claude-kit-ignore <id|all>` (one line).
  - Check-ids: `todo-markers`, `dead-code`, `magic-numbers`, `select-star`,
    `sql-injection`, `file-length`, `broken-doc-links` (pre-write); `store-grep`,
    `source-discovery` (query-gate); `duplication` (jscpd); `lint`; `commit-log`
    (commit-gate); `request-capture` (request-gate).
- Per-project overrides: `.claude-kit-ignore.yaml` (exclude paths/blocks from gate checks),
  `.claude-tooling-ok` (silence missing-tool warnings).

# MEMORY HYGIENE
- Never silently prune memory or log entries — present them; the user decides.
- A memory index (e.g. MEMORY.md) stays an index: one line per entry, short. Content
  lives in separate files; keep each file small. Durable rules belong in CLAUDE.md, not
  memory.
- When a weekly-review nag fires (memory or maintenance), present the rundown for the
  user to decide, then touch the timestamp.

# DATABASE & ORM DISCIPLINE
Before writing any DB code, run this checklist:
- **No SELECT \*** — enumerate columns always (hook blocks this).
- **No string-built SQL** — parameterize always. f-strings, template literals, and
  concatenation containing SQL keywords are injection-shaped (hook warns; human review
  required).
- **Every new table gets**: PK, `created_at timestamptz` (Postgres) / `DATETIME`
  (SQLite/MySQL), indexes on all FKs, indexes on every column appearing in a WHERE clause
  of a known query.
- **Postgres**: prefer `text` over `varchar(n)` unless length is a real constraint. Use
  `timestamptz`, never `timestamp`. Use `jsonb`, never `json`.
- **MySQL**: charset `utf8mb4` always, never `utf8`. Collation explicit.
- **SQLite**: `PRAGMA foreign_keys = ON`. WAL mode for anything concurrent.
- **Drizzle**: explicit `columns` selector on wide tables. Use `with:` for relations,
  never query-in-loop. Types inferred from schema via `InferSelectModel`/
  `InferInsertModel`, never hand-written. Migrations via `drizzle-kit generate`.
- **Alembic**: every migration has a non-empty `downgrade()` (hook blocks empty ones). If
  truly irreversible, document why AND raise `NotImplementedError`. Never hand-edit
  `op.execute()` with string-built SQL.
- **ORMs in loops** — prevent N+1. Load relations eagerly with `with:`/`joinedload`/
  `selectinload`.
- **Transactions** — keep scope tight. Never hold a transaction across a network call to
  a third party.
- **Migrations are reversible and tested against prod-like data before merge.**
