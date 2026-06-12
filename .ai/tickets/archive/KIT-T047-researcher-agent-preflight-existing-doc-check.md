---
id: KIT-T047
title: researcher/design-doc agent preflight — search prior art (docs/research + cited docs) before commissioning, EXTEND the canonical doc, never spawn a parallel one
type: tech-debt
status: done
priority: medium
milestone:
labels: [process-failure, agents]
links: [KIT-T041, KIT-T042]
files: []
supersedes:
superseded_by:
created: 2026-06-06T02:35:00Z
updated: 2026-06-12T15:25:16Z
---

## Description
PROCESS MISS (2026-06-05, HOD): a researcher/design-doc agent was commissioned for buildings WITHOUT first searching docs/research/ for the existing canonical doc (enterable-buildings.md) the phase tickets already cite → produced a duplicate doc; cost a researcher run + a reconciliation merge. Root causes: (1) the SESSION spine listed one buildings doc but not the canonical one → trusted an incomplete hand-maintained index; (2) no queryable research-doc index (KIT-T041/T042 — the index half). This ticket is the BEHAVIOR half: before launching a researcher/design-doc agent on a topic, search docs/research/ AND the topic's tickets' cited docs for prior art; EXTEND the canonical doc, never commission a parallel one.

## Acceptance Criteria
- [x] A documented preflight step (and ideally an automated check) runs before any researcher/design-doc agent spawn: grep docs/research/ + the topic tickets' cited docs for an existing canonical doc on the topic.
- [x] If a canonical doc exists, the agent is instructed to EXTEND it (not author a parallel doc).
- [x] Depends on / composes with the research-doc cache index (KIT-T041/T042) so the preflight can query the cache rather than raw grep.

## Plan
Scoped 2026-06-12 (drain). DEPENDENCY CHANGED: the index half (KIT-T041/T042 — a queryable
research-doc cache) is now **superseded**, so AC3 ("compose with the cache index") cannot rely
on it. The preflight falls back to a direct scan of `docs/research/` (H1 + frontmatter titles)
+ the topic tickets' cited docs. Behavior half is otherwise independently buildable.
1. **Contract step** in `agents/researcher.md` (+ any `/research` path): a PREFLIGHT — before
   authoring, scan `docs/research/` titles/frontmatter and the topic tickets' cited docs for an
   existing canonical doc on the topic.
2. **Extend-not-duplicate**: if a canonical doc exists, instruct the agent to EXTEND it, never
   author a parallel doc (the failure this fixes).
3. **Automated check (relaxed)**: since the cache index is superseded, ship a lightweight
   `scripts/research-preflight.mjs <topic>` (or fold into `q fts`, IF research docs are FTS-indexed)
   that lists candidate canonical docs — verify current research-doc discoverability first and
   pick scan-vs-q accordingly. AC3 is satisfied by this fallback, not the dead index.
Verification: a test asserting the preflight surfaces a known canonical doc for a matching topic
and stays silent for a novel one.
OPEN (for the go): full preflight SCRIPT now, or documented contract-step + manual scan only?

## Notes
- 2026-06-06: split from the 2026-06-05 process-miss cap. The index half is KIT-T041/T042; this is the agent-preflight behavior half.
- 2026-06-12: KIT-T041/T042 are superseded — AC3's "cache index" no longer exists; preflight scans docs/research/ directly instead.
- 2026-06-12 (done): shipped `scripts/research-preflight.mjs` (topic-term scan of docs/research/ filename+H1+frontmatter, ranked output, fail-open); PREFLIGHT section added to `agents/researcher.md`; one-liner added to `commands/drain.md`; `scripts/research-preflight.test.mjs` wired into `npm test`. All 12 new tests pass, full suite exit 0.

## History
- [2026-06-12 15:21] (status) todo → doing
- [2026-06-12 15:24] (comment) ticked: A documented preflight step (and ideally an automated check) runs before any researcher/design-doc agent spawn: grep docs/research/ + the topic tickets' cited docs for an existing canonical doc on the topic.
- [2026-06-12 15:24] (comment) ticked: If a canonical doc exists, the agent is instructed to EXTEND it (not author a parallel doc).
- [2026-06-12 15:24] (comment) ticked: Depends on / composes with the research-doc cache index (KIT-T041/T042) so the preflight can query the cache rather than raw grep.
- [2026-06-12 15:25] (status) doing → review
- [2026-06-12 15:25] (status) review → done
