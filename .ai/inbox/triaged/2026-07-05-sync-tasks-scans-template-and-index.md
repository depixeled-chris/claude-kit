bug: sync-tasks.mjs emits phantom tasks from non-ticket files

Observed in jollys-vinyl 2026-07-05 (fresh init-project): the emitted task spec
included `INDEX Ticket board` (from tickets/INDEX.md) and `KEY-T000 ## Plan` (from
tickets/_TEMPLATE.md) alongside the real JV-T00x rows — and pulled criteria from
`todo` backlog tickets, though hydration is defined as active-ticket(s) only.
sync-tasks should skip `_TEMPLATE.md` + generated views (INDEX.md) and probably
filter to status: doing.

Captured from: jollys-vinyl session (source: `node scripts/sync-tasks.mjs` output).
