---
id: KIT-T092
title: Request/Epic first-class types + requests/epics stores + taxonomy + templates (KIT-T003 child)
type: feature
status: done
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T091]
files: []
supersedes:
superseded_by:
created: 2026-06-12T19:52:29Z
updated: 2026-06-12T21:00:08Z
---

## Description
Child of [[KIT-T003]] (criterion 3). Request (`R`) and Epic (`E`) become first-class
item TYPES with their own stores (`requests/`, `epics/`), config taxonomy entries, and
templates — the type machinery the HOD re-key ([[KIT-T093]]) needs as its destination.
Depends on [[KIT-T091]] (`aka:`). Sequenced AFTER T091, BEFORE T093. claude-kit-only.

## Acceptance Criteria
- [x] `requests/` and `epics/` stores exist; `id-utils.mjs` mints `<KEY>-R###` / `<KEY>-E###` for them (same fixed-prefix pattern as D/Q/N).
- [x] config taxonomy: `request` + `epic` classifications/types with `routes_to` the new stores.
- [x] `_TEMPLATE.md` for each store (frontmatter + Notes/History per KIT-D037).
- [x] `index-tickets.mjs` enumerates the new stores; rundown/board include them; not flagged as unknown.
- [x] `npm test` covers id-minting + store discovery for the new types.

## Plan
1. `id-utils.mjs`: register `requests`/`epics` stores + R/E prefixes in the store/type maps. (Touches lib.mjs scanners? If store-scan lives in lib.mjs — GATED on KIT-T021; confirm at build time and split if so.)
2. config taxonomy entries (repo + template).
3. Templates for the two stores.
4. index-tickets.mjs enumeration + tests.

## Notes
Implementation complete. Key findings:

- `STORE_TYPE` in `scripts/id-utils.mjs` extended with `requests: 'R'` and `epics: 'E'`. `KNOWN_STORE_ORDER` also updated so the stores get a stable, deterministic scan position.
- Store enumeration (`storeDirs`) is AUTO-DISCOVERY based: any `.ai/` subdir not in `NON_STORE_DIRS` is included. `requests/` and `epics/` dirs are therefore picked up by `scanStores`, `statStoreFiles`, `nextId`, and the board pipeline with zero further wiring.
- `index-tickets.mjs` reads ONLY `tickets/` (the `readTickets` function is ticket-specific); the broader rundown/worklist pipeline reads via `q.mjs` → `scanStores` which now auto-discovers both new stores. Board confirmed not flagged as unknown in the full test run.
- `lib.mjs` review-queue/stale-doing scanners do NOT yet cover requests/ — deferred to KIT-T093 (gated on KIT-T021). Those two scanners are ticket-specific by design; they are NOT a general store list and do not need to change for T092.
- Templates: `_TEMPLATE.md` added to `.ai/requests/`, `.ai/epics/`, `project-template/.ai/requests/`, `project-template/.ai/epics/`. Epics template adds a `## Children` section for child-link enumeration.
- Config taxonomy: `request` and `epic` classifications added to both `.ai/config.yml` and `project-template/.ai/config.yml`, each with `routes_to:` the new store and `priority: medium, blocking: never`. `dispatch.default_tier` entries added: `request: standard`, `epic: deep`.
- `npm test` result: full suite exit 0. `id-utils.test.mjs` now has 41 passed (28 prior + 13 new KIT-T092 assertions covering R/E id-minting, max+1 increment, scanStores discovery, collision detection, and POSIX path invariant).

## History
- [2026-06-12 19:52] (created) feature — Request/Epic first-class types + requests/epics stores + taxonomy + templates (KIT-T003 child)
- [2026-06-12 20:55] (status) todo → doing
- [2026-06-12 20:59] (comment) ticked: `requests/` and `epics/` stores exist; `id-utils.mjs` mints `<KEY>-R###` / `<KEY>-E###` for them (same fixed-prefix pattern as D/Q/N).
- [2026-06-12 20:59] (comment) ticked: config taxonomy: `request` + `epic` classifications/types with `routes_to` the new stores.
- [2026-06-12 20:59] (comment) ticked: `_TEMPLATE.md` for each store (frontmatter + Notes/History per KIT-D037).
- [2026-06-12 20:59] (comment) ticked: `index-tickets.mjs` enumerates the new stores; rundown/board include them; not flagged as unknown.
- [2026-06-12 20:59] (comment) ticked: `npm test` covers id-minting + store discovery for the new types.
- [2026-06-12 21:00] (status) doing → done
