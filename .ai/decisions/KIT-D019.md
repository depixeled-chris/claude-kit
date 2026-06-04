---
id: KIT-D019
title: "Failures are PROCESS failures, never personal — don't frame as 'my/your failure'; fix the process"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04 (maintainer directive — and a directive that itself went uncaptured)
---

**Decision:** A failure in this work is a PROCESS/SYSTEM failure, not a personal one. Do not frame
anything as "my failure" / "your failure" / self-blame. The premise of claude-kit is that the
process must prevent the failure REGARDLESS of which operator (which Claude) is at the wheel — so
when something breaks, the response is to fix the PROCESS (capture, enforce, harden), not to
apologize or assign personal blame. (Distinct from KIT-D018-era nuance: a Claude mistake is still a
Claude mistake, not "design" — but the FIX is always a process fix, never "I'll try harder.")

**Why:** The maintainer stated this and I violated it by saying "my failure to keep the plan-of-
record current." Worse: the directive itself was never captured, so it didn't survive in context —
which is the exact context-failure mode KIT-D015/KIT-T023 exist to kill. Personalizing failures also
wastes the signal: "I failed" produces apology; "the process failed" produces a hook/ticket that
prevents recurrence. Capture every such directive the turn it lands so it's enforced, not remembered.
