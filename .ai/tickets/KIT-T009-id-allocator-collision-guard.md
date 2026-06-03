---
id: KIT-T009
title: Programmatic ID allocation + collision guard (markdown-served carve-out of KIT-T004)
type: feature
status: review
priority: high
milestone:
labels: [ids, integrity, hooks, workflow]
links: [KIT-T004, KIT-D011]
files:
  - scripts/id-utils.mjs
  - scripts/next-id.mjs
  - scripts/check-ids.mjs
  - scripts/id-utils.test.mjs
  - scripts/index-tickets.mjs
  - hooks/commit-gate.mjs
  - hooks/sync-data.mjs
created: 2026-06-03T22:45:00Z
updated: 2026-06-03T22:45:00Z
---

## Description
Two ticket files shared id `HOD-T045` (a real collision) because IDs are hand-picked by the
agent at triage/ticket-creation — there was no allocator, and `index-tickets.mjs` silently
last-write-wins on a duplicate id. The maintainer (2026-06-03) required a PROGRAMMATIC fix
so id assignment + integrity don't rely on the LLM. This is the markdown-served carve-out of
KIT-T004 that the ticket itself licenses landing early ("next-ID doesn't have to wait for
SQLite — it can serve from the markdown scan today; the DB just makes it O(1)").

## Acceptance Criteria
- [x] `scripts/id-utils.mjs` — pure, dependency-free: scan all stores (tickets+archive,
      decisions, notes, questions), detect duplicate ids + frontmatter/filename mismatches,
      compute `max(num)+1` next-id from `config.yml` ids.key/pad + the store→letter scheme.
- [x] `scripts/next-id.mjs <store> [root]` — prints the next free id (allocator CLI).
- [x] `scripts/check-ids.mjs [root]` — integrity CLI: exit 1 + report on dup/mismatch.
- [x] `index-tickets.mjs` fails loud (exit 1) on a duplicate ticket id instead of silently
      overwriting in `byId`.
- [x] `commit-gate.mjs` blocks a commit that touches the stores while a collision/mismatch
      exists (local + non-centralized adopted repos). Fails open on a scan error.
- [x] `sync-data.mjs` blocks the auto-commit of the centralized data repo on a collision —
      the path that actually let HOD-T045 persist (project `.ai` is a junction). Fails open.
- [x] Automated test `scripts/id-utils.test.mjs` (12 cases) wired into `npm test`; green.
- [x] Live HOD-T045 collision resolved: re-keyed `world-gen-into-core` → `HOD-T049` using
      the new allocator; `check-ids` reports HOD clean.

## Plan
Done — see History.

## Notes
- 2026-06-03: Built id-utils + the two CLIs + tests (12/12 pass). Wired the guard into
  BOTH commit paths because the bug bit a CENTRALIZED project (HOD): the dup lands in the
  data repo via `sync-data`, NOT through `commit-gate` — guarding only commit-gate would
  have missed the exact case that happened.
- 2026-06-03: Dogfooded — `check-ids /d/dev/hustle-or-die` flagged the dup (exit 1);
  `next-id tickets` returned HOD-T049; re-keyed; re-check clean.
- Defers to KIT-T004: the SQLite cache still makes next-id O(1) and adds FTS/graph queries
  later (after KIT-T003). This ticket satisfies KIT-T004's next-ID + collision-integrity
  criteria early via the markdown scan, as that ticket's note authorizes.
- Follow-up (not done here): point triage/work/template prompts at `next-id.mjs` so the
  agent stops hand-picking ids — see History.
- 2026-06-03: Cross-platform — id tooling is pure Node (runs on any OS). Fixed reported
  paths to be POSIX-style on every OS (`path.join` was emitting backslashes on Windows);
  added a test asserting no backslashes. The remaining OS assumption is `bootstrap.sh`
  (bash + symlinks, POSIX-only) — split out to KIT-T011.
