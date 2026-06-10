---
id: KIT-T078
title: "Command-level model tiering — static `model:` on fixed-cost read-only commands"
type: tech-debt
status: review
priority: low
milestone:
labels: [tokens, models, commands]
files:
  - commands/standup.md
  - commands/prime.md
  - commands/triage.md
  - skills/doc-audit/SKILL.md
links: [KIT-D022, KIT-T034, KIT-D031, KIT-D029]
supersedes:
superseded_by:
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Description
Distinct lever from KIT-T034 (per-ticket model routing). Some commands/skills have an
**intrinsic, fixed cost** regardless of which ticket is in play — they read the cache and format
a briefing, full stop. For those, a static `model:` in frontmatter is the right tool (verified:
the field is honored for both commands and skills, overriding the model for the rest of the turn).
This does NOT generalise to the work-execution path (`/drain`, `/work`), whose cost is
ticket-dependent — that is KIT-T034's job and stays model-blind here.

Applies the KIT-D022 complexity principle at the command granularity:
- pure read-cache-and-format → haiku
- light judgment (classification / synthesis / doc-vs-code analysis) → sonnet, NOT haiku
  (a haiku "all clear" from doc-audit or a misclassified triage is false economy)

## Acceptance Criteria
- [x] `commands/standup.md` → `model: haiku` (read cache, format, done).
- [x] `commands/prime.md` → `model: sonnet` (deep-resume synthesis).
- [x] `commands/triage.md` → `model: sonnet` (inbox classification = judgment).
- [x] `skills/doc-audit/SKILL.md` → `model: sonnet` (code/doc cross-referencing).
- [ ] Observed at runtime: after a plugin/session reload, invoking one of these actually runs on
      the downgraded model (frontmatter override is doc-verified but not yet seen live).
- [x] `/status` deliberately EXCLUDED — slated for deletion (KIT-D029, pending KIT-T068/M4); not
      worth tuning a doomed file.

## Notes
- 2026-06-10: Surfaced from a maintainer `/usage` review (drain ≈10% of usage). Established that
  the `/usage` "run heavy skills on a cheaper model" tip misapplies to `/drain` — drain is a thin
  command whose cost IS the engineering work, so downgrading it degrades real output (false
  economy). The tip DOES fit fixed-cost read-only commands; this ticket is that narrow application.
- Landed against the KIT-D031 token-diet deferral by explicit maintainer override (2026-06-10):
  the effort was already spent, the change touches no integrity/gate machinery D031 protects, and
  D031 governs where NEW effort goes, not a freeze on done trivial work. The larger per-ticket
  routing (KIT-T034) stays deferred per D031.
- [no-test: reason] config-only frontmatter; no behavioral test applies. Runtime confirmation is
  the open AC above (requires a reload to observe).

## History
- [2026-06-10 00:00] (created) command-level model tiering, 4 files; status→review.
