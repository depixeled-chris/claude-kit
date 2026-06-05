---
description: Cross-project status glance — terse "what needs me?" briefing from the cache, read-only
argument-hint: "[project ...]"
---
A bare ask for "status" / "what's our status" routes HERE — the cross-project glance, NOT a
single-repo readout from SESSION.md. Run the survey (it queries the cache, falls back to a
scan) and SHOW it. Read-only: do **not** confirm scope, resume, pick up, or change anything.

```
node "<KIT>/scripts/survey.mjs" --brief $ARGUMENTS
```

Resolve `<KIT>` (the claude-kit repo/plugin root) as `$CLAUDE_PLUGIN_ROOT` if set, else the
`claude-kit` entry in `~/.claude/claude-kit-projects.json`.

- **No project named** → `--brief`: waiting-on-you first (review backlog collapsed to a
  count + a few ids), then one line of open work per project. **No SESSION dump.** Present it
  as-is and stop.
- **One or more named** → drop `--brief` is unnecessary; the script gives each named project
  its full deep view (SESSION + open tickets + git). Present and stop.

Obey the wall-of-text rule: lead with the answer, terse bullets, no preamble. Do not re-read
SESSION.md or ticket files by hand — the survey is the source. `/prime` is the deep resume
twin; this is the glance.
