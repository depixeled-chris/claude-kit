---
id: KIT-D015
title: "/clear at any point loses nothing — the primary pillar of claude-kit"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04
---

**Decision:** Being able to `/clear` (or be compacted) at ANY moment, in ANY context, and lose
NOTHING is claude-kit's single biggest pillar — the thing every other mechanism serves. A cold
resume must reconstruct the full working state from disk + git alone, never from the model's
memory or a chat summary. This is the explicit yardstick for the whole system: if a `/clear`
here would drop work, that is a claude-kit defect, not user error.

Concretely, "lose nothing" requires every class of live state to be continuously on disk:
- **Accepted requests** → captured to `.ai/inbox/` at accept-time (request-gate Stop hook).
- **Decisions/directives** → a decisions file the turn they happen.
- **Work** → committed at task boundaries, citing its ticket (commit-gate).
- **Working memory** → SESSION.md current after EVERY meaningful step (not just at PreCompact/Stop).
- **In-flight delegated subagents** → their roster (task, scope, handle) recoverable on resume.
- **Orient** replays all of the above at SessionStart so the resume re-primes automatically.

**Why:** The tight agentic feedback loop the maintainer wants — fire observations off the top,
delegate, clear freely — only works if clearing is consequence-free. If `/clear` can lose work,
the maintainer must hoard context (long sessions, fear of compaction), which is exactly the
failure mode claude-kit exists to kill. Rejected: treating SESSION.md flush as a
PreCompact-only concern (leaves a stale anchor between flushes) and treating background-agent
orchestration as ephemeral in-context state (a `/clear` orphans the delegated work). The gap
that exposed this — a cold resume has no on-disk record of which background agents are mid-flight
— is tracked in KIT-T014.
