# DECISIONS

Append-only. One entry per settled point — what was decided, what was rejected,
and why. This is what lets Claude make judgment calls without re-asking and
stops every new session from re-proposing a discarded approach.

**Never delete entries.** To reverse a decision, append a new one that
supersedes it and reference the old id.

Format:

```
## YYYY-MM-DD  <short title>  [KIT-D001]
Decided: <the choice>.
Rejected: <the alternative>. Why: <reason>.
```

<!-- example:
## 2026-06-01  Refresh trigger strategy  [KIT-D001]
Decided: proactive refresh at t-5min via timer.
Rejected: refresh-on-401. Why: causes a failed request + retry storm under
concurrency; user sees a flicker. Don't revisit unless we drop the timer infra.
-->
