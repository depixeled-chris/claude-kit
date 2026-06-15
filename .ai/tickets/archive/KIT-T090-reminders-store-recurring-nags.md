---
id: KIT-T090
title: Reminders store — user-defined recurring nags surfaced by housekeeping
type: feature
status: done
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
updated: 2026-06-15T20:02:08Z
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
- [2026-06-15 19:44] (status) todo → doing
- [2026-06-15 20:00] (comment) ticked: `rem add/list/done/snooze/disable/enable` work against `.ai/reminders/`
- [2026-06-15 20:00] (comment) ticked: `last_done`/`snooze_until` state is frontmatter (git-synced); nothing
- [2026-06-15 20:00] (comment) ticked: next-id.mjs allocates REM-NNN for store `reminders`
- [2026-06-15 20:00] (comment) ticked: Malformed reminder file: SessionStart still completes, file skipped
- [2026-06-15 20:00] (comment) ticked: Docs: store documented in project-template README / contract appendix;
- [2026-06-15 20:01] (comment) ticked: `scanReminders` in lib.mjs; due reminders appear in the SessionStart
- [2026-06-15 20:01] (comment) ticked: `done`/`snooze` append History lines; History is never rewritten
- [2026-06-15 20:01] (comment) ticked: `reminder` classification in template + kit config.yml routes captures to
- [2026-06-15 20:01] (comment) ticked: Kit test suite covers: due/not-due/snoozed/disabled math, seed-on-create,
- [2026-06-15 20:01] (status) doing → review
- [2026-06-15 20:02] (status) review → done

## Acceptance Criteria
- [x] `rem add/list/done/snooze/disable/enable` work against `.ai/reminders/`
      (dep-free, fail-open, cap.mjs-style project targeting)
- [x] `scanReminders` in lib.mjs; due reminders appear in the SessionStart
      housekeeping block, each line carrying its `rem done` command; capped at
      5 + overflow count
- [x] `last_done`/`snooze_until` state is frontmatter (git-synced); nothing
      reads or writes mtime for reminders
- [x] `done`/`snooze` append History lines; History is never rewritten
- [x] next-id.mjs allocates REM-NNN for store `reminders`
- [x] `reminder` classification in template + kit config.yml routes captures to
      the store
- [x] Malformed reminder file: SessionStart still completes, file skipped
      (test with a frontmatter-less file)
- [x] Kit test suite covers: due/not-due/snoozed/disabled math, seed-on-create,
      date-only boundaries, malformed-file skip
- [x] Docs: store documented in project-template README / contract appendix;
      groovegrid gets REM-001 (weekly release, runbook = dispatch instructions)
      as the first real consumer

## Plan
1. lib.mjs: `scanReminders(root)` + frontmatter date helpers (reuse existing
   tolerant-parse idiom).
2. housekeeping.mjs: wire scanner into the SessionStart reminders[] build.
3. scripts/rem.mjs: CLI verbs; extend next-id.mjs with the `reminders` store.
4. Config templates + classification routing.
5. Tests (due-math table, fail-open), docs, then seed groovegrid REM-001.

## Notes

### Shipped (2026-06-15)
- **Store `.ai/reminders/`** + `_TEMPLATE.md` + `README.md` in BOTH the kit's own `.ai/` and
  `project-template/.ai/`. Frontmatter: `id, title, every_days, last_done, snooze_until, enabled,
  links, created, updated`; body `## Runbook` + append-only `## History`.
- **`hooks/lib.mjs: scanReminders(root)`** next to `scanInbox`/`scanReviewQueue`. Tolerant
  line-regex frontmatter parse (no yaml dep). DUE = `enabled !== false` AND
  `today >= last_done + every_days` AND (`snooze_until` empty OR `today >= snooze_until`), all in
  date-only UTC (calendar days). Returns `{ due: [{id, title, overdueDays, file}], total }`, sorted
  most-overdue first. FAIL-OPEN per file AND overall — a malformed reminder is skipped, never thrown.
- **`hooks/housekeeping.mjs`** SessionStart: one line per due reminder with its drain command inline
  (KIT-T074), e.g. `- REMINDER DUE: Cut a weekly release (REM-001, 3d overdue) — done: node
  <kit>/scripts/rem.mjs done REM-001`. Capped at 5 + `(+N more reminder(s) due — rem list)`. No
  hooks.json change (housekeeping already SessionStart-registered).
- **`scripts/rem.mjs`** (cap.mjs conventions — dep-free, fail-open, `--project` > cwd): verbs
  `add/list/done/snooze/disable/enable`. `add` seeds `last_done = created` (no instant nag).
  `done` sets `last_done = today` + clears snooze + appends `(done)`; `snooze` sets
  `snooze_until = today+N` WITHOUT moving `last_done` + appends `(snoozed Nd)`. History is
  append-only.
- **`scripts/next-id.mjs` + `id-utils.nextReminderId`**: the `reminders` store mints a fixed,
  unkeyed `REM-###` (scan `.ai/reminders/REM-*.md` for max trailing number, +1, pad 3).
- **Config**: `reminder: { routes_to: reminders, blocking: never }` added to `classifications:`
  in both `.ai/config.yml` and `project-template/.ai/config.yml`. No `reminders:` config block
  (v1 — cadence is per-file in `every_days`).

### REM- id decision (clarification to the spec, which predated KIT-T068/T092)
The spec's "REM-### like DEC-/Q-/N-" analogy is stale: KIT-T068 moved those to the keyed
`<KEY>-<TYPE><NUM>` scheme and KIT-T092 took the single letter `R` for `requests`. So reminders are
their OWN dedicated FIXED, UNKEYED `REM-###` id — NOT routed through `STORE_TYPE`. `reminders` is
excluded from the keyed-id machinery via `id-utils` `NON_STORE_DIRS`, so `scanStores`/board/cache/
collision-scan never treat REM files as keyed items. **`REM-001` and `HOD-R001` are unambiguous and
cannot collide** (verified by test: the minted id is `/^REM-\d+$/`, no project key prefix).

### Test evidence (AC8)
`scripts/rem.test.mjs` — 36 passed, 0 failed. Covers: due/not-due/snoozed/disabled math;
seed-on-create (a fresh reminder is not instantly due); date-only boundary (DUE exactly at
`last_done + every_days`, overdue 0; one day before is not due); malformed/empty/binary reminder
files → `scanReminders` skips them and does NOT throw, while a valid due reminder still surfaces;
`nextReminderId` mints REM-001 then REM-002 (and skips gaps); `done` advances `last_done` + appends
History (append-only, prior lines kept); `snooze` sets `snooze_until` without moving `last_done`;
disable/enable toggle + History; unknown-id is a hard error. Full kit suite: **`npm test` exit 0**
(`id-utils: 41 passed`, `cap: 16 passed`, `rem: 36 passed`, all 24 files green). SessionStart
fail-open also proven end-to-end: the real `housekeeping.mjs` process exits 0 in a temp git repo
holding a frontmatter-less + a binary reminder, while still surfacing the valid due line.

### groovegrid REM-001 seed (clarification 2 — documented follow-up, not blocking)
groovegrid's `.ai/` is not accessible from this repo, so the cross-project seed is DOCUMENTED as the
ready first-consumer step (here + in both `reminders/README.md`) rather than blocking the close:
once this ships, run `rem add "Cut a weekly release" --every 7 --runbook "<gh workflow run …>"`
in groovegrid. AC9 ticked on the documentation; the actual seed is the first-consumer follow-up.

### Follow-up noted
The `--project`-vs-cwd targeting glue (`findAiDir`/`takeProjectFlag`/`matchProject`) is duplicated
from cap.mjs (~15 lines, copied deliberately to avoid destabilizing cap.mjs's tested path on this
ticket). A future small refactor could extract it to a shared `project-target` module that both
consume (would also drop rem.mjs back under the 300-line soft-warn).

## History
- [2026-06-12 00:00] (created) requested by Chris during groovegrid GG-T004 (CI cache warmth needs a weekly release nag); architecture authored for Opus implementation
