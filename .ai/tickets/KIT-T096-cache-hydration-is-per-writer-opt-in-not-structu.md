---
id: KIT-T096
title: Cache hydration is per-writer opt-in, not structural — cap (+ other Bash-invoked item writers) mutate items WITHOUT hydrating; make every item write hydrate-at-source via one write-through primitive
type: bug
status: doing
priority: high
milestone:
labels: [cache, hydration, correctness]
links: []
files:
  - hooks/lib.mjs
  - scripts/cap.mjs
  - scripts/rem.mjs
  - scripts/reconcile-supersede.mjs
supersedes:
superseded_by:
created: 2026-06-15T21:57:00Z
updated: 2026-06-15T21:58:12Z
---

## Description
POLICY (maintainer, 2026-06-15): **the derived SQLite cache must hydrate the changed item AT THE
MUTATION SITE, every time an item changes — never "catch up later" at Stop/read/startup.** Startup
is for a background AUDIT (reconcile out-of-band drift: git pull / another machine / a parallel
session), NOT a hydration mechanism.

Today hydration is bolted onto SOME writers, not structural. Audited every `hydrate()` caller:
- HYDRATE at the site (✓): `t.mjs` (status/tick/new, inline), `triage/apply.mjs` + `triage/handle.mjs`,
  and hand `Write`/`Edit` of a `.ai/` file via the `ingest-data` PostToolUse hook.
- DO NOT (✗): **`cap.mjs`** — writes an inbox item via a Bash `node cap.mjs` call, so it neither calls
  `hydrate()` itself NOR triggers the Write/Edit ingest hook → the captured item is invisible to the
  cache until a later Stop/read-self-heal (the confirmed live violation). `rem.mjs` (T090 excluded
  reminders from the cache in v1 — revisit). `reconcile-supersede.mjs` writes supersede edges to
  ticket files without hydrating. Nothing makes forgetting impossible — the next item-writer is a
  silent new gap.

Root cause: there is no single write-through item primitive; each writer re-implements (or forgets)
the hydrate. Fix = make "write an item → hydrate that item" the ONLY way to write an item.

## Acceptance Criteria
- [ ] A single write-through primitive in `hooks/lib.mjs` (e.g. `writeItemFile(absFile, content)`) that
      writes the markdown AND hydrates that item's scope (`hydrate({root})`, the incremental manifest-diff —
      NOT `ifStale`, since the mutation site KNOWS it changed). Resolves the store root from the path;
      no-ops the hydrate cleanly when the path is not under a managed `.ai/` store or no engine exists.
- [ ] Fail-open on the HYDRATE only: the file write must always succeed; a hydrate failure (no engine,
      etc.) degrades to the markdown fallback and is logged, never loses the write.
- [ ] `cap.mjs` routes its item write through the primitive — a `cap` makes the item queryable
      IMMEDIATELY (no Stop / read-self-heal needed). This is the confirmed-gap close.
- [ ] Every other direct item-writer routes through it too: `rem.mjs` (reminders become cache-visible —
      retire the T090 v1 cache-exclusion) and `reconcile-supersede.mjs`. `t.mjs`/`triage` already hydrate;
      adopt the primitive for consistency OR leave their inline hydrate (document the choice).
- [ ] Startup stays AUDIT-only: do NOT add a SessionStart hydrate-as-mechanism. The audit (drift
      reconcile for out-of-band changes) remains `q verify` + the read-time self-heal. (Optional: a
      SessionStart background audit that LOGS drift — not required.)
- [ ] GUARANTEE TEST: for EACH mutation entry point (`cap`, `rem add`, `t new`/`t status`,
      `triage apply`), assert that immediately after the mutation — with NO Stop hook and NO read-self-heal —
      the changed item is fresh in the cache (`q verify <scope>` fresh AND the item is returned by a direct
      DB query). The test proves the invariant at every path, not a spot check.

## Plan
1. `hooks/lib.mjs`: add `writeItemFile(absFile, content)` — `writeFileSync` then resolve `storeRoot` and
   `await hydrate({ root })` (dynamic-import hydrate-db; try/catch the hydrate, never the write).
2. Convert `cap.mjs`, `rem.mjs`, `reconcile-supersede.mjs` to use it (drop their bare `writeFileSync`).
3. Decide t.mjs/triage: keep inline hydrate or adopt primitive (note it).
4. Guarantee test (`scripts/hydrate-at-source.test.mjs` or extend db-cache.test.mjs) over every entry point.
5. `npm test` green. Note in Notes: startup is audit-only by design.

## History
- [2026-06-15 21:57] (created) bug — Cache hydration is per-writer opt-in, not structural — cap (+ other Bash-invoked item writers) mutate items WITHOUT hydrating; make every item write hydrate-at-source via one write-through primitive
- [2026-06-15 21:58] (status) todo → doing
