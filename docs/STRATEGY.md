# Strategy

The reasoning behind every piece of the kit. Read this once; it makes the rest
self-explanatory.

## The diagnosis: amnesia is a storage-location bug

When important state lives in the chat buffer, compaction rewrites it into prose,
and prose paraphrases. Exact error strings, `file:line` refs, command flags,
version pins, and rejected approaches get rounded off — the "plain language
rounding error." The cure is one principle:

> **State lives in files. The chat is a working surface, not a database.**

Everything below follows from that. A fresh session is cheap because re-priming
is "read these 3 files and continue," not "let me re-explain everything."

## The two natures

Chris is reactive and associative — ideas, bugs, and questions arrive in a
stream, out of order, mid-task. Claude is good at context switching but only when
the context is **stable, deduplicated, and already-litigated**; otherwise it
re-asks, re-proposes rejected ideas, and stalls.

The kit reconciles them by splitting the roles:

| Chris | Claude |
|---|---|
| Capture (fire and forget) | Classify + route + receipt |
| Override when needed | Defer by default |
| Set direction / priorities | Drain the queue between tasks |
| Decide the genuinely-ambiguous | Answer the self-answerable, batch the rest |

## The interjection router

The core inversion: **the default is capture, not steer.** Historically anything
you say steers Claude immediately (blocking). Here, anything you say is captured
to the right place and Claude keeps working; blocking is the exception.

For each interjection Claude: **classify → route → one-line receipt → continue.**
The receipt (`→ BUG-024 logged (high), still on T-001`) is your audit trail — a
misroute is corrected in three words instead of discovered later.

Blocking fires only when the classification's `blocking` rule in `config.yml`
says so (`scope-change` → always; a regression caused by the current edit; an
input about the exact area being edited) or when you say "stop." This is the
"pause and discuss when the work is actually affected" you asked for — judged per
input, not a blanket gate.

## Config-driven taxonomy

Hardcoding types would kill flexibility. `.ai/config.yml` is the single source of
truth for classifications, priorities, statuses, drain rules, and receipts. The
`CLAUDE.md` contract *points at* it rather than restating it, so a one-line edit
to config changes behavior everywhere — no code, no contract edit. (This honors
"one source of truth for all types/models.")

Add `spike`, `chore`, `security`, `idea` — whatever — by adding a line.

## Backlog and roadmap

Same ticket store, two views:

- **Backlog** = `status: todo`, no `milestone`. Everything captured lands here.
- **Roadmap** (`ROADMAP.md`) = sequenced milestones. Scheduling a ticket = giving
  it a `milestone`. When a current milestone exists, the drain works it in order
  before pulling loose backlog.

Early/chaotic projects run on pure priority; mature ones earn a roadmap. You
choose per project by editing config — not by switching tools.

## Driving "later" without you

A backlog nobody drains is a graveyard. The drain runs on Claude's action:

- **Between tickets** — on `review`, pull the next item (roadmap order, else
  type-order + priority). Low-risk + pattern-following → start it; else surface
  one line and move on. No idle waiting.
- **Questions** — answer the code-answerable ones and log them; batch Chris-only
  questions for natural breaks, never as interruptions.
- **Regressions** — priority-bumped, surfaced proactively.
- **Anti-relitigation** — reopening a `DECISIONS.md` point gets a one-line
  citation, not a re-debate. Settled stays settled — the antidote to feeling like
  you're working with someone with amnesia.

## Two layers of task tracking

- **Durable (the truth):** the ticket file in `.ai/tickets/`. Travels in git,
  survives everything, cross-machine.
- **Live view (a projection, kept in sync):** the native Claude Code task list
  (`TaskCreate`/`TaskUpdate`). It drives the in-UI spinner and is per-session +
  machine-local, so it's never the handoff layer — but it is a **faithful,
  bidirectional projection** of the tickets, not a throwaway. Because Claude is the
  only writer of native tasks, sync is just discipline at write time + a rebuild on
  start (D-005, `config.yml → native_task_sync`):
  - Hydrate the native list from the active ticket(s) at session start
    (`scripts/sync-tasks.mjs`), since native tasks don't survive a session.
  - Keep both in lockstep: a ticket change updates its native task and vice versa.
  - Each ticket-backed native task is titled `T-NNN …` so it's distinct from ad-hoc
    ones; an orphan (unprefixed) task is promoted to `.ai/` so no work lives only in
    the ephemeral list.

## Task history & regressions

Every ticket carries an append-only `## History` — a timestamped audit trail of status
changes, comments, decisions, and blockers — so "what happened and why" survives in the
file, not the chat. Decisions that cross tickets also land in `DECISIONS.md`; the
ticket's History is the local log.

A recurring bug is tracked as a **`regression` ticket**, not a silent reopen: it links
`regressed_from:` the original and records the `causing_commit:`, and the original gets
a `(regressed) → T-NNN` history line. That makes **repeat offenders visible** — the
generated `REGRESSIONS.md` shows the chain `original → recurrence → …`, longest first.

It's all markdown — no database. A prior iteration (the `workflow` repo) mirrored this
into SQLite/Prisma and found the DB redundant: the markdown `work/active|completed/<id>/`
tree was already the source, and a DB isn't diff-able, drifts from the files, and adds a
process. So the reference files (`tickets/INDEX.md`, `REGRESSIONS.md`) are **generated**
from the tickets by `scripts/index-tickets.mjs` — fast lookup without becoming a second
source of truth. Done tickets archive to `tickets/archive/` to keep the active board small.

## Token discipline

- Search via subagents; they read many files and return a paragraph, keeping the
  main thread lean and pushing back the next compaction.
- Re-prime with **pointers, not payloads** — name files, don't paste them.
- Prefer flush + `/clear` + re-prime at milestones over riding one giant session.
  When you must `/compact` mid-task, pass an explicit preserve-list.

## Cross-machine model

- **Project state** (`.ai/`) rides the project repo via `git pull`/`push`. This
  is the only reliable carrier — sessions, auto-memory, and native tasks are all
  machine-local and will silently diverge.
- **Machine config** rides this repo, symlinked into `~/.claude`.
- Sessions do **not** resume across machines. The replacement is: `git pull` →
  fresh session → paste the re-prime line from `SESSION.md`. Cheaper and cleaner
  than a cross-machine resume would be anyway.

## Optional enforcement (not in v1)

`CLAUDE.md` is a strong suggestion, not a hard gate. If the soft protocol ever
slips, add hooks (portable Node scripts, not OS shell strings) for the **core,
verified** events only — `SessionStart`, `PreCompact`, `Stop`,
`PreToolUse`/`PostToolUse`, `UserPromptSubmit`:

- `SessionStart` → inject the re-prime instruction.
- `PreCompact` + `Stop` → force a SESSION.md flush before context is lost.
- `PreToolUse` on `Edit|Write` → block until the active ticket is `doing` and
  scope is acknowledged (the hard version of the scope gate).

Hook event names beyond that core set are version-fragile — confirm against your
installed version before wiring them.

## Verification note

Built from a 5-way research pass plus an adversarial critic grounded against
Claude Code v2.1.160. Corrections folded in: the native Task tools **do** exist
(earlier research wrongly said task management is external-only); the "routines
`/fire` curl" with an `experimental-cc-routine` header was **hallucinated** — the
real primitives are `CronCreate` (local/durable) and `RemoteTrigger` (cloud).
Specific byte caps for compaction survival and exact `/loop` jitter figures were
flagged version-fragile and are not relied on here.
