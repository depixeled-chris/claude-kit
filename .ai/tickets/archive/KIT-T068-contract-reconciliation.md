---
id: KIT-T068
title: Contract reconciliation — one truth for Notes/History, triage semantics, ID templates, command surface
type: tech-debt
status: done
priority: high
milestone: M4-one-truth
labels: [docs, contract, commands]
files:
  - commands/work.md
  - commands/drain.md
  - commands/standup.md
  - commands/status.md
  - commands/triage.md
  - project-template/CLAUDE.snippet.md
  - project-template/.ai/inbox/README.md
  - project-template/.ai/questions/_TEMPLATE.md
  - project-template/.ai/decisions/_TEMPLATE.md
  - project-template/.ai/notes/_TEMPLATE.md
links: [KIT-T069]
supersedes:
superseded_by:
created: 2026-06-10T03:10:00Z
updated: 2026-06-12T17:41:52Z
---

## Description
The written contract contradicts itself in five places; every contradiction is a future
misbehavior:
1. Notes vs History split-brain: /work + /drain say append to `## Notes`; the ticket
   template defines only `## History`. Pick ONE (live-repo convention is Notes for prose +
   History for events — decide and write it down everywhere).
2. Triage deletes vs moves caps: triage.md says move to `inbox/triaged/`; inbox README +
   snippet say delete. Pick one (recommend move — never destroy provenance).
3. ID templates stale vs the `<KEY>-<TYPE><NUM>` scheme: `Q-000`, `DEC-NNN`, `N-NNN`.
4. drain.md re-states the whole /work contract inline (already diverged once) — replace
   with a reference.
5. Command surface: DELETE /status (collides with the native Claude Code /status
   built-in, so the kit's is shadowed and needs the namespaced form anyway); /standup is
   the surviving glance verb. standup.md's "deep view" line corrected to match --brief.
- [2026-06-12 17:31] (status) todo → doing
- [2026-06-12 17:40] (comment) ticked: One documented Notes/History convention, consistent across template, snippet, /work, /drain.
- [2026-06-12 17:41] (comment) ticked: One documented triage cap disposition, consistent across all three docs.
- [2026-06-12 17:41] (comment) ticked: Q/D/N templates carry scheme-correct example ids.
- [2026-06-12 17:41] (comment) ticked: drain.md references the /work contract instead of duplicating it.
- [2026-06-12 17:41] (comment) ticked: commands/status.md deleted; standup.md accurate; README command list updated.
- [2026-06-12 17:41] (comment) ticked: DECISIONS entries recorded for the Notes/History and triage-disposition picks.
- [2026-06-12 17:41] (status) doing → done

## Acceptance Criteria
- [x] One documented Notes/History convention, consistent across template, snippet, /work, /drain.
- [x] One documented triage cap disposition, consistent across all three docs.
- [x] Q/D/N templates carry scheme-correct example ids.
- [x] drain.md references the /work contract instead of duplicating it.
- [x] commands/status.md deleted; standup.md accurate; README command list updated.
- [x] DECISIONS entries recorded for the Notes/History and triage-disposition picks.

## Plan
1. Decide + record the two conventions.
2. Sweep the files; delete /status.

## Notes
- 2026-06-09: opened from the full-plugin review. /status-vs-/standup decided by Chris 2026-06-09: keep /standup (native /status collision).
- 2026-06-12: KIT-D037 created (Notes=prose/History=events). Fixed both repo and project-template _TEMPLATE.md, CLAUDE.md, CLAUDE.snippet.md, both inbox READMEs, all Q/D/N templates (repo + project-template), slimmed drain.md to a single /work reference, deleted commands/status.md, updated README.md command list. Stale forms (Q-000, DEC-NNN, N-NNN, "deletes it") verified gone from live surfaces via grep. [no-test: contract reconciliation; verified by doc-audit-style reference check + grep that old forms are gone]
