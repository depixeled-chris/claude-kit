---
description: Mid-flight glance — show the cross-project "what needs me?" briefing without resuming or changing anything
argument-hint: "[project ...]"
---
Read-only standup. Run the survey and SHOW it — do **not** confirm scope, do **not**
continue, pick up, or change any in-progress work. This is a glance, not a resume.

```
node "<KIT>/scripts/survey.mjs" --brief $ARGUMENTS
```

Resolve `<KIT>` (the claude-kit repo/plugin root) as `$CLAUDE_PLUGIN_ROOT` if set, else the
`claude-kit` entry in `~/.claude/claude-kit-projects.json`.

- **No project named** → present the briefing as-is: waiting-on-you first, then the one-line
  per-project open work, then the active project's deep view. Then **stop** and return to
  whatever we were doing.
- **One or more named** → show each one's deep view (SESSION + open tickets + git). Then **stop**.

This is the read-only twin of `/prime`: same briefing, but it never restates a plan to act on
and never starts new work. The user asked for a readout, not a resume.
