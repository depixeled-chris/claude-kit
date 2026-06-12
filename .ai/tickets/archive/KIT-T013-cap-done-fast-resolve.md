---
id: KIT-T013
title: cap --done fast-resolve — log an already-handled item without inbox/triage debt
type: feature
status: done
priority: medium
milestone:
labels: [capture, cap, workflow, dogfooding]
links: [KIT-T006, KIT-T008]
files:
  - scripts/cap.mjs
  - .ai/config.yml
created: 2026-06-03T01:15:00Z
updated: 2026-06-12T14:46:41Z
---

## Description
Surfaced by dogfooding on gridiron-blitz. In a reactive live-loop (Chris fires a
bug → I fix + deploy it in the same turn), `cap` only writes an OPEN inbox item.
Those pile up: a real session left 7 un-triaged captures, 3 of which were already
fixed and deployed — the capture half works, the triage/drain half gets bypassed
under live-loop pressure, so the inbox accrues stale debt that reads as open work.

Need a one-step "I already handled this — log it, don't queue it." `cap --done
<text>` should record the item as resolved, bypassing inbox/triage, so there's an
audit trail without triage debt.

Open design question (decide before building): WHERE does a resolved-without-ticket
item live, given the atomic one-file-per-item rule (D-009)?
- Option A: a `log/` (or `resolved/`) folder of one-file-per-event records — new
  concept, but cleanest separation from the triage path.
- Option B: write to `notes/` as an N-NNN marked resolved — reuses an existing
  routing target, no new folder, but conflates "durable note" with "event log".
- Option C: write to `inbox/` with a `(done)` marker and have the drain auto-archive
  it — smallest change, but still routes through triage (the thing we're avoiding).
Leaning A (a dedicated resolved-event log) — it keeps inbox = open queue invariant.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them. -->
- [x] `cap --done <text>` (and optional `cap --done <type> <text>`) writes a resolved
      record OUTSIDE the inbox triage queue
- [x] the record carries a resolved timestamp + optional type, same slug/date scheme as cap
- [x] `cap` with no `--done` is byte-for-byte unchanged (open inbox capture)
- [x] index/board generation does not count resolved records as open work
- [x] README/usage line documents `--done`

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1. Decide A/B/C (default A) — confirm with Chris since it touches taxonomy.
2. Add `--done` flag parse to cap.mjs arg handling (before the type/words split).
3. Write the resolved record to the chosen destination.
4. Update index-tickets.mjs only if the destination affects counts.

## Notes
<!-- append-only log of decisions/progress while working — never delete prior notes -->
- [2026-06-03 01:15] (created) From gridiron-blitz dogfooding. Tasked rather than
  hot-fixed: it touches the kit's shared taxonomy (where resolved items live), so it
  needs a design decision, not a unilateral mid-playtest script change.
- [2026-06-03 01:15] (decision) DROPPED the sibling "CLAUDE_DATA default" idea —
  misdiagnosis. cap/index/sync already resolve the centralized store via the `.ai`
  SYMLINK (findAiDir walks up and follows it); CLAUDE_DATA is only read by
  init-project.mjs at one-time scaffold. No per-call env is needed. Nothing to fix.
- [2026-06-03 01:20] (comment) rekeyed T012→T013: a remote machine concurrently
  claimed KIT-T012 (code-graph). Same hazard KIT-T009 (id-allocator collision guard)
  exists to solve — this is live evidence for it.
- [2026-06-12 14:46] (done) `--done` flag added to cap.mjs (takeDoneFlag before takeProjectFlag); writes to `.ai/resolved/` with `resolved:` ISO timestamp. `resolved` added to NON_STORE_DIRS in id-utils.mjs so never counted as open work. index-tickets.mjs untouched (only scans tickets/). config.yml untouched. Decision KIT-D036 created. README updated. cap.test.mjs: 16/16; npm test exit 0. hooks/lib.mjs NOT edited.
</content>

## History
- [2026-06-12 14:40] (status) todo → doing
- [2026-06-12 14:45] (comment) ticked: `cap --done <text>` (and optional `cap --done <type> <text>`) writes a resolved
- [2026-06-12 14:45] (comment) ticked: `cap` with no `--done` is byte-for-byte unchanged (open inbox capture)
- [2026-06-12 14:45] (comment) ticked: README/usage line documents `--done`
- [2026-06-12 14:46] (comment) ticked: the record carries a resolved timestamp + optional type, same slug/date scheme as cap
- [2026-06-12 14:46] (comment) ticked: index/board generation does not count resolved records as open work
- [2026-06-12 14:46] (status) doing → done
