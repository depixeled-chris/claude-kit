---
id: KIT-T090
title: Reminders store — user-defined recurring nags surfaced by housekeeping
type: feature
status: todo
priority: medium
milestone:
labels: [hooks, stores, housekeeping]
files: [hooks/housekeeping.mjs, hooks/lib.mjs, scripts/rem.mjs, scripts/next-id.mjs, project-template/.ai/config.yml]
tier: standard
model: opus
effort: high
links: [KIT-T074, KIT-T027]
supersedes:
superseded_by:
created: 2026-06-12T00:00:00Z
updated: 2026-06-12T00:00:00Z
regressed_from:
causing_commit:
fixed_commit:
provenance: given
---

## Description

Chris wants recurring obligations ("squeeze in some kind of weekly improvements",
"cut a weekly release so the CI caches stay warm") to nag him without anyone
having to remember them. The kit already nags at SessionStart (housekeeping.mjs:
inbox staleness, review queue, memory/maintenance review) but every nag type is
HARDCODED. This ticket adds a user-defined reminders store: one file per
recurring obligation, surfaced by the existing housekeeping block when due,
cleared by a one-command "done".

Driving use case (groovegrid): GitHub Actions caches evict after 7 days unused;
a release must run at least weekly from master or the next build is a cold seed
(~420 billed min vs ~60-100 warm). That's exactly a `REM-001 every_days: 7`.

Related: KIT-T074's thesis (nags without a drain path train you to ignore them)
is a design constraint here — every reminder nag line must carry its own
resolution command. KIT-T027 (store redesign) may later absorb this store; the
design below follows the existing per-store conventions so absorption is cheap.

## Architecture (decided — implement as specified)

### 1. Store: `.ai/reminders/` — one file per reminder (D-009 atomic convention)

`<project>/.ai/reminders/REM-NNN-<slug>.md`:

```yaml
---
id: REM-001
title: Cut a weekly release (keeps GH Actions caches warm)
every_days: 7
last_done: 2026-06-12          # date-only ISO; SEEDED to created date (see #5)
snooze_until:                  # optional date-only ISO; suppresses nag until then
enabled: true
links: []                      # e.g. the governing ticket
created: 2026-06-12T00:00:00Z
updated: 2026-06-12T00:00:00Z
---

## Runbook
<what doing this reminder actually means — commands, links, context>

## History
- [2026-06-12 00:00] (created)
```

**State lives in frontmatter, NOT file mtime.** This is the one place the
design deliberately diverges from the existing memory/maintenance nags
(`~/.claude/...last-reviewed`, mtime-based): those are machine-local by intent;
reminders travel in git with the rest of `.ai/`, and git checkout/clone
destroys mtimes. `last_done` as a committed field is the only cross-machine-
correct option (Chris works macOS + Windows).

Body is a runbook, History is append-only per the standard store contract.

### 2. Surfacing: a new scanner in the existing housekeeping flow

- `hooks/lib.mjs`: add `scanReminders(root)` next to `scanInbox` /
  `scanReviewQueue` (lib.mjs ~605-723). Reads `.ai/reminders/*.md`, parses
  frontmatter with the same tolerant line-regex style already used (NO yaml
  dependency). Returns `{ due: [{id, title, overdueDays, file}], total }`.
  A reminder is DUE when `enabled !== false` AND
  `today >= last_done + every_days` AND (`snooze_until` empty or past).
  Malformed file → skip silently (fail-open — a broken reminder must never
  wedge SessionStart).
- `hooks/housekeeping.mjs` SessionStart (the reminders[] build, ~108-139):
  one line per due reminder, WITH its drain command inline (KIT-T074
  constraint):

  ```
  - REMINDER DUE: Cut a weekly release (REM-001, 3d overdue) — done: node <kit>/scripts/rem.mjs done REM-001
  ```

  Cap at 5 lines + `(+N more — rem list)` to keep the block scannable.
- No hooks.json change — housekeeping is already registered for SessionStart.

### 3. CLI: `scripts/rem.mjs` (mirrors cap.mjs conventions: no deps, fail-open)

```
rem add "<title>" --every <days> [--runbook "<text>"] [--project <name|path>]
rem list [--all]              # default: due + upcoming; --all includes disabled
rem done <id>                 # last_done = today, updated = now, History line
rem snooze <id> <days>        # snooze_until = today + days, History line
rem disable <id> | enable <id>
```

- Project targeting copies cap.mjs exactly: `--project` flag > cwd fallback.
- `rem done` / `snooze` MUST append a History line (`(done)` / `(snoozed Nd)`)
  — the recurring obligation's audit trail is how "did we actually do the
  weekly release in May?" gets answered later.
- Id allocation: extend `scripts/next-id.mjs` to accept store `reminders`
  (fixed prefix `REM-`, pad 3 — same pattern as DEC-/Q-/N- fixed prefixes).

### 4. Config + capture routing

- `project-template/.ai/config.yml` (and kit's own): add classification

  ```yaml
  classifications:
    reminder:
      routes_to: reminders
      blocking: never
  ```

  so an interjection like "remind me to do X weekly" routes through the normal
  capture→triage path into the store. No `reminders:` config block in v1 —
  cadence lives per-file in `every_days`; there are no global thresholds to
  tune (YAGNI until two projects want different surfacing behavior).

### 5. Decided edge cases (do not relitigate, just implement)

- **New reminder seeds `last_done = created`** — creating a reminder must not
  instantly nag; first nag fires after one full cadence.
- **Date-only comparison** (UTC dates, not timestamps) — "weekly" means
  calendar days; avoids same-day re-nag hair-splitting.
- **Snooze does not move `last_done`** — done and deferred are different
  events, and History records which one happened.
- **`every_days` integer only.** No cron syntax, no weekday anchoring. A
  reminder that needs "every Monday" is out of scope until someone asks.
- **Per-project only.** Cross-project rollup belongs to the existing /prime //
  /status briefing surface, not the SessionStart hook (which is cwd-scoped).
  Note it there as a follow-up line item; do not build it here.
- **No q.mjs / cache indexing in v1.** The store is small (single-digit files
  per project); direct scan is fine. KIT-T027 can absorb it into the cache
  later.

## Acceptance Criteria
- [ ] `rem add/list/done/snooze/disable/enable` work against `.ai/reminders/`
      (dep-free, fail-open, cap.mjs-style project targeting)
- [ ] `scanReminders` in lib.mjs; due reminders appear in the SessionStart
      housekeeping block, each line carrying its `rem done` command; capped at
      5 + overflow count
- [ ] `last_done`/`snooze_until` state is frontmatter (git-synced); nothing
      reads or writes mtime for reminders
- [ ] `done`/`snooze` append History lines; History is never rewritten
- [ ] next-id.mjs allocates REM-NNN for store `reminders`
- [ ] `reminder` classification in template + kit config.yml routes captures to
      the store
- [ ] Malformed reminder file: SessionStart still completes, file skipped
      (test with a frontmatter-less file)
- [ ] Kit test suite covers: due/not-due/snoozed/disabled math, seed-on-create,
      date-only boundaries, malformed-file skip
- [ ] Docs: store documented in project-template README / contract appendix;
      groovegrid gets REM-001 (weekly release, runbook = dispatch instructions)
      as the first real consumer

## Plan
1. lib.mjs: `scanReminders(root)` + frontmatter date helpers (reuse existing
   tolerant-parse idiom).
2. housekeeping.mjs: wire scanner into the SessionStart reminders[] build.
3. scripts/rem.mjs: CLI verbs; extend next-id.mjs with the `reminders` store.
4. Config templates + classification routing.
5. Tests (due-math table, fail-open), docs, then seed groovegrid REM-001.

## History
- [2026-06-12 00:00] (created) requested by Chris during groovegrid GG-T004 (CI cache warmth needs a weekly release nag); architecture authored for Opus implementation
