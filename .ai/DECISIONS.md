# DECISIONS

Append-only. One entry per settled point — what was decided, what was rejected,
and why. This is what lets Claude make judgment calls without re-asking and
stops every new session from re-proposing a discarded approach.

**Never delete entries.** To reverse a decision, append a new one that
supersedes it and reference the old id.

Format:

```
## YYYY-MM-DD  <short title>  [D-001]
Decided: <the choice>.
Rejected: <the alternative>. Why: <reason>.
```

<!-- example:
## 2026-06-01  Refresh trigger strategy  [D-001]
Decided: proactive refresh at t-5min via timer.
Rejected: refresh-on-401. Why: causes a failed request + retry storm under
concurrency; user sees a flicker. Don't revisit unless we drop the timer infra.
-->

## 2026-06-02  claude-kit is the single source of truth for all Claude tooling  [D-001]
Decided: every Claude *tool* — hooks, slash commands, statusline, the settings
template, and the global CLAUDE.md rules — is authored and versioned HERE. `~/.claude`
becomes a derived install: `bootstrap.sh` symlinks/merges from the kit. Reproduce a
machine with `git clone && ./bootstrap.sh`.
Rejected: hand-maintaining `~/.claude` per machine. Why: it's unversioned and
machine-local, silently drifts across machines, and can't be reproduced — exactly the
amnesia this kit exists to kill. Nothing tooling-related is authored in two places.

## 2026-06-02  Public kit + private overlay  [D-002]
Decided: the kit is public + MIT and holds NON-proprietary content only. Anything
sensitive — personal CLAUDE.md rules, proprietary product strategy/research, private
agents — lives in a separate **private overlay** (a private repo or a gitignored
`~/.claude/private/`). `bootstrap.sh` composes public + private.
Rejected: one public file scrubbed by hand each time. Why: a structural boundary means
secrets cannot reach the MIT repo by construction, instead of relying on the author (or
Claude) to scrub correctly every time.

## 2026-06-02  Enforcement hooks are portable Node, installed globally but opt-in-aware  [D-003]
Decided: hooks are written in Node, installed once per machine from the kit, and
`exit 0` immediately unless the project has `.ai/`. "Global install" then never
interferes with unadopted projects, and nothing is copied into individual repos.
Rejected: bash/OS-shell hook scripts; per-project hook copies. Why: bash hooks hit
Windows/MSYS + Python path bugs and a heredoc-stdin bug that silently disabled a hook
(observed directly); Node is portable. Per-project copies = "two places" to maintain.

## 2026-06-02  The kit is also the cross-project research KB + non-proprietary agent library  [D-004]
Decided: `research/` (indexed, generic findings) and `agents/` (non-proprietary agent
definitions, improved by iteration) live in the kit. Discipline: check the KB before
researching; update in place; one place to reference and update.
Rejected: per-project research silos; bulk-importing existing project research. Why:
reuse across projects; and product/strategy-specific research (and anything citing
proprietary/unlicensed frameworks) must stay private — migration is a per-doc
classification, not a bulk move.

## 2026-06-02  .ai/ tickets ↔ native task list stay in sync  [D-005]
Decided: the native Claude Code task list is a **live, bidirectional projection** of
the `.ai/` ticket system — not the throwaway one-way mirror the earlier framing called
it. The ticket file stays the durable truth (native tasks are per-session +
machine-local). Rules:
- **Single writer:** Claude writes both together — every ticket status/criterion change
  is paired with the matching `TaskUpdate`, and every native status change is written
  back to the ticket in the same step.
- **Hydrate on start:** the native list is ephemeral, so rebuild it from the active
  ticket(s) at session / `/work` start (`scripts/sync-tasks.mjs` emits the spec).
- **Prefix:** every kit-managed native task's subject carries its ticket id (`T-001 …`)
  so ticket-backed tasks are visibly distinct from ad-hoc ones.
- **Promote orphans:** a native task with no `T-` prefix is unpersisted — capture it to
  `.ai/INBOX.md` (triage then makes it a ticket) and re-tag the native task. Nothing
  important lives only in the ephemeral list.
- **Status map** (config.yml `native_task_sync`): todo→pending, doing→in_progress,
  review/done→completed. Native has no review/human-gate; the ticket keeps that.
Rejected: native→ticket via a hook or daemon. Why: there is no task-change hook and the
native list isn't disk-exposed — but it doesn't matter, because Claude is the **only**
writer of native tasks, so writing both in lockstep + hydrating on start IS the sync.
Source: conversation 2026-06-02.

## 2026-06-02  Tasks carry history; bugs carry regression tracking — markdown, not a DB  [D-006]
Decided: every ticket carries an **append-only history** (timestamped audit trail of
status changes, comments, decisions, blockers/questions), and bugs carry **regression
tracking** (a recurrence links to the original + the causing/fixing commits; repeat
offenders are visible in a reference file). It stays **markdown + folder hierarchy +
generated index/reference files** — no SQLite/DB.
Rejected: a SQLite/Prisma store (the approach in the prior `D:\dev\workflow` repo, last
touched 2025-11). Why: a DB isn't transparent or diff-able, drifts from the files, and
adds a process; that repo already kept the real state in markdown (`work/active|completed/
<id>/` with `agents/*.md` work-history, `context/decisions.md`, `context/blockers.md`)
and even logged a self-question "should we keep markdown files?" — the DB was redundant.
Gleaned the **fields** from its schema (agent_assignments = who/what/when/status;
blockers = type blocker|question, open→resolved; decisions per task) and drop the DB.
Source: conversation 2026-06-02; prior art D:\dev\workflow (commit de12897).
Shape (settled with maintainer 2026-06-02): single-file tickets with an append-only
`## History` section; done tickets archive to `.ai/tickets/archive/`; bug recurrences
are `regression` tickets linking `regressed_from`/`causing_commit`/`fixed_commit`;
`scripts/index-tickets.mjs` generates `tickets/INDEX.md` (board) + `REGRESSIONS.md`
(chains). Config: `history` + `regressions` blocks in config.yml.
Deferred (maintainer, 2026-06-02): **agent-assignment attribution** — the prior repo's
`agent_assignments` (who/which-agent did what) is NOT carried over. History has no agent
dimension yet; not needed now. Revisit only if multi-agent work needs per-agent
accountability — then add an `(event)` actor field, don't reintroduce a table.

## 2026-06-02  Commit AND push at every task boundary, referencing the work item  [D-007]
Decided: at each task boundary, **commit and push** — not just commit — and reference the
work item in the message (`implements T-007` / `D-006`). Pushing between tasks (not only
committing) keeps the remote as a recoverable rewind point from any machine.
Rejected: batching a whole session into one commit, or committing without pushing. Why:
a local-only commit dies with the working copy/machine, and one big commit gives no
granular rewind point. Tightens the global GIT WORKFLOW; the commit-gate already enforces
the citation half (a code commit must cite its item).
Source: conversation 2026-06-02.

## 2026-06-02  Centralize workflow DATA in a private repo; project repos hold only a pointer  [D-008]
Decided: split tooling from data across two repos.
- **claude-kit** (public, MIT) = tooling ONLY (hooks, commands, skills, agents, templates,
  scripts, docs).
- **claude-kit-data** (private) = ALL workflow data for ALL projects, centralized:
  `projects/<name>/` each holding ROADMAP / DECISIONS / SESSION / INBOX / QUESTIONS /
  tickets (+ archive) / INDEX / REGRESSIONS, plus the D-002 private `overlay/`.
A project repo houses NO workflow content — only a one-line `.claude-project` pointer; its
`.ai/` becomes a gitignored symlink/junction to `$CLAUDE_DATA/projects/<name>/`, so existing
`.ai/`-reading tooling keeps working unchanged.
Why (maintainer): (1) invoke the system from anywhere, not only inside a project repo; (2)
standardization — every project identical, in one place; (3) backups — one private repo to
sync, replacing per-repo `.ai/` syncing.
Supersedes: STRATEGY "cross-machine model: `.ai/` rides the project repo (the only reliable
carrier)" — for a solo/private line a single central private repo is the better carrier.
Folds in D-002: the private overlay lives in `claude-kit-data/overlay/`.
Trade-off (surfaced, accept knowingly): the atomic "work + its log in the SAME commit"
property (the three absolutes; commit-gate enforced) breaks across two repos. The gate
degrades to **cite-only** in the project repo; claude-kit-data is committed separately —
auto-committed on ticket/history change (a hook) to keep it ~atomic.
Owed: design the resolution mechanism + the gate change + the migration (move hod `.ai/` →
`claude-kit-data/projects/hustle-or-die/`, including the ROADMAP `R###` → ticket-format
migration) WITH the maintainer before building. Source: conversation 2026-06-02.

## 2026-06-02  Every item-category is atomic files in a folder, like tickets — no monolith stores  [D-009]
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
