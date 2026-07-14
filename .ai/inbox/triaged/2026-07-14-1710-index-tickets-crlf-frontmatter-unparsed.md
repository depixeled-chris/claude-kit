# index-tickets.mjs silently fails to parse CRLF ticket frontmatter

type: bug
project: groovegrid (found), affects every repo on Windows
captured: 2026-07-14T17:10Z

`readTickets()` extracts frontmatter with `/^---\n([\s\S]*?)\n---/`
(scripts/index-tickets.mjs:56). A ticket whose FIRST line ends `\r\n` (CRLF —
normal on Windows editors / autocrlf checkouts) never matches, so the whole
frontmatter reads as empty and the board renders a junk row: id = filename,
type/status/priority = "—". Two groovegrid tickets (GG-T003, GG-T009) sat
invisible-by-status on the board this way — a review-queue item the drain and
the human /done pass both miss. SILENT failure: no warning is emitted.

Fix: `/^---\r?\n([\s\S]*?)\r?\n---/` + strip `\r` in `field()`/`listField()`
values (`.trim()` already handles trailing `\r`, the delimiter lines are the
real break). Audit the same idiom in db-parse.mjs / q.mjs / t.mjs — t.mjs
WRITES files it read, so it may also preserve/introduce CRLF. Add a
warning when a .md in tickets/ yields no frontmatter (silent junk rows are
how this hid for a month).
