---
# id: NEVER hand-pick — allocate with `node <kit>/scripts/next-id.mjs reminders` (KIT-T090).
# Reminders use a FIXED, UNKEYED REM-### id (NOT the <KEY>-<TYPE><NUM> scheme): they are a
# user-defined nag store, not a keyed work store, so REM-001 reads the same in every project
# and never collides with a project's R-prefixed requests (KIT-D-… clarified during KIT-T090).
id: REM-000
title: <what recurring obligation this nags about>
every_days: 7                  # integer cadence in CALENDAR days; first nag fires after one full cadence
last_done: <YYYY-MM-DD>        # date-only ISO; SEEDED to the created date so a new reminder never instantly nags
snooze_until:                  # optional date-only ISO; suppresses the nag until this date passes
enabled: true                  # set false (or `rem disable`) to mute without deleting
links: []                      # the governing ticket/decision/URL, if any
created: <YYYY-MM-DDThh:mm:ssZ>
updated: <YYYY-MM-DDThh:mm:ssZ>
---

## Runbook
<!-- What DOING this reminder actually means — the exact commands, links, and context, so the
     nag carries its own resolution. The SessionStart line also prints `rem done <id>`. -->

## History
<!-- APPEND-ONLY, oldest first. One line per event; NEVER edit or delete a prior line — this is
     the obligation's audit trail (how "did we cut the weekly release in May?" gets answered).
     Format:  - [YYYY-MM-DD HH:MM] (event) detail      events: created | done | snoozed | disabled | enabled -->
- [<YYYY-MM-DD HH:MM>] (created)
