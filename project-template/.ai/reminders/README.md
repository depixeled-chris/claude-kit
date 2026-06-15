# reminders/ — user-defined recurring nags

One file per recurring obligation (atomic — KIT-D009). The SessionStart housekeeping hook
surfaces the ones that are DUE today, each line carrying its own resolution command (KIT-T074:
a nag without a drain path trains you to ignore it). Add with `rem add`, clear with `rem done`.

Driving use case: GitHub Actions caches evict after 7 days unused, so a release must run at
least weekly or the next build is a cold seed — that's a `REM-001 every_days: 7`.

## State lives in frontmatter, not file mtime

Reminders travel in git with the rest of `.ai/`, and `git checkout`/`clone` destroys mtimes.
So the cadence anchor `last_done` is a committed date-only field — the only cross-machine-correct
option (work happens on macOS + Windows). This is the deliberate divergence from the machine-local,
mtime-based memory/maintenance nags.

## CLI (`rem`)

```
rem add "<title>" --every <days> [--runbook "<text>"] [--project <name>]
rem list [--all]              # due + upcoming; --all also shows disabled
rem done <id>                 # last_done = today, (done) History line, clears any snooze
rem snooze <id> <days>        # snooze_until = today + days, (snoozed Nd) line; last_done UNCHANGED
rem disable <id> | enable <id>
```

`--project` targets like `cap` (flag > the nearest `.ai/` above cwd). `done`/`snooze`/`disable`/
`enable` append a `## History` line — that audit trail is how "did we cut the weekly release in
May?" gets answered later. History is append-only; never rewrite it.

## DUE logic

A reminder is DUE when, in **date-only UTC** (calendar days, not timestamps):
`enabled !== false` AND `today >= last_done + every_days` AND (`snooze_until` empty OR
`today >= snooze_until`). A freshly-added reminder seeds `last_done` to its created date, so the
first nag fires only after one full cadence — creating one never instantly nags.

## IDs — fixed, unkeyed `REM-###`

Reminders are the one store NOT on the `<KEY>-<TYPE><NUM>` scheme. The id is a fixed, unkeyed
`REM-001`, `REM-002`, … minted by `next-id.mjs reminders` (a `reminders` special case, scanning
this dir for the max trailing number). It reads the same in every project and CANNOT collide with
a project's `R`-prefixed requests (`REM-001` ≠ `HOD-R001`). Because reminders are not a keyed work
store, `reminders` is excluded from the keyed-id machinery (`id-utils` `NON_STORE_DIRS`), so the
board/cache/collision-scan never treat REM files as keyed items.

## First consumer (follow-up)

groovegrid is the first real consumer: seed `REM-001` (weekly release, every_days 7, runbook =
the `gh workflow run` dispatch for its release workflow) so the GH Actions caches stay warm. That
seed lives in groovegrid's own `.ai/` and is created there with `rem add` once this store ships.
