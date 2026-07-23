---
id: KIT-D045
title: Maintainer does UAT; Claude owns automated tests end to end
date: 2026-07-23
supersedes:
source: conversation 2026-07-23 (fountain-previz session)
---

**Decision:** Automated tests are run AND responded to by Claude — they are
Claude's verification loop, and their results are Claude's to act on, never a
deliverable handed to the maintainer. The maintainer does UAT only. The
end-of-turn "what can be tested" receipt (KIT-T099) must therefore be
UAT-shaped: a user-facing command or experience to try (open this URL, run
this CLI and read its output, listen to this wav) — never "run pytest" /
"npm test". Automated-test results appear in receipts only as already-run
evidence ("116 passed"), not as instructions.

**Why:** fountain-previz 2026-07-23 — turns ended by pointing the maintainer
at pytest commands; maintainer: "I don't run automation tests. That's you...
I do UAT." A test-suite receipt is process noise to the human, dodges the
real acceptance question, and silently reassigns Claude's verification duty.
Rejected: keeping "run the suite" as an acceptable receipt when nothing is
UAT-able — the honest form is `[no-test: <reason>]` plus the already-run
automated evidence.
