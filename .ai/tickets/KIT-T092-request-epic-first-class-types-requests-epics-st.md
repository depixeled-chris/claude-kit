---
id: KIT-T092
title: Request/Epic first-class types + requests/epics stores + taxonomy + templates (KIT-T003 child)
type: feature
status: todo
priority: medium
milestone:
labels: []
links: [KIT-T003, KIT-T091]
files: []
supersedes:
superseded_by:
created: 2026-06-12T19:52:29Z
updated: 2026-06-12T19:52:29Z
---

## Description
Child of [[KIT-T003]] (criterion 3). Request (`R`) and Epic (`E`) become first-class
item TYPES with their own stores (`requests/`, `epics/`), config taxonomy entries, and
templates — the type machinery the HOD re-key ([[KIT-T093]]) needs as its destination.
Depends on [[KIT-T091]] (`aka:`). Sequenced AFTER T091, BEFORE T093. claude-kit-only.

## Acceptance Criteria
- [ ] `requests/` and `epics/` stores exist; `id-utils.mjs` mints `<KEY>-R###` / `<KEY>-E###` for them (same fixed-prefix pattern as D/Q/N).
- [ ] config taxonomy: `request` + `epic` classifications/types with `routes_to` the new stores.
- [ ] `_TEMPLATE.md` for each store (frontmatter + Notes/History per KIT-D037).
- [ ] `index-tickets.mjs` enumerates the new stores; rundown/board include them; not flagged as unknown.
- [ ] `npm test` covers id-minting + store discovery for the new types.

## Plan
1. `id-utils.mjs`: register `requests`/`epics` stores + R/E prefixes in the store/type maps. (Touches lib.mjs scanners? If store-scan lives in lib.mjs — GATED on KIT-T021; confirm at build time and split if so.)
2. config taxonomy entries (repo + template).
3. Templates for the two stores.
4. index-tickets.mjs enumeration + tests.

## History
- [2026-06-12 19:52] (created) feature — Request/Epic first-class types + requests/epics stores + taxonomy + templates (KIT-T003 child)
