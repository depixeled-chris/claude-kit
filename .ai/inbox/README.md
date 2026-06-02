# inbox/ — raw capture

One file per captured idea (atomic — D-009), fire-and-forget. `cap` writes them here;
**triage** promotes each into `tickets/` / `decisions/` / `questions/` / `notes/` and
then deletes the inbox file. Nothing durable lives here — it's the intake buffer that
drains.

Filename: `YYYY-MM-DD-HHMM-<slug>.md`. Body is freeform; an optional `(type)` on the
first line hints the classification:

```
(bug) SSO login loops after token refresh
repro: sign in, let the token expire, click anything → redirect loop
```

This folder is never an index — the board/roadmap are generated from the durable
folders by `scripts/index-tickets.mjs`.
