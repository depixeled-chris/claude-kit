---
id: KIT-T151
title: Dispatch ladder unenforced: delegations inherit fable session model (pin agent tiers + hook gate)
type: bug
status: done
priority: medium
milestone:
labels: []
links: []
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:51:38Z
updated: 2026-07-23T19:05:54Z
fixed_commit: 985d243
---

## Description
<!-- what and why — fill in via Edit -->

## Acceptance Criteria
<!-- each a checkable observation; t tick checks these as they pass -->
- [ ]

## Plan
1.

## History
- [2026-07-23 18:51] (created) bug — Dispatch ladder unenforced: delegations inherit fable session model (pin agent tiers + hook gate)
- [2026-07-23 18:51] (status) todo → doing
- [2026-07-23 18:51] (comment) @claude: Promoted from inbox capture 2026-07-23-1847 (deleted on promote). Scope per Chris: pin research/coding agent tiers to op (full comment #1 in ## Notes)
### comment #1 [2026-07-23 18:51] @claude
Promoted from inbox capture 2026-07-23-1847 (deleted on promote). Scope per Chris: pin research/coding agent tiers to opus in kit agent frontmatter, encode in global committed config, and add hook enforcement (fable-inherit block). Chris: 'Those research agents need to run on Opus... in the controls for ClaudeKit as well as the global committed config. Fable is expensive.' + 'That needs good enforcement too.'
- [2026-07-23 19:05] (status) doing → done
- [2026-07-23 19:05] (comment) @claude: (fixed) 985d243 - pins + gate + wiring shipped; kit suite green (npm test exit 0) incl. new 14-case dispatch-guard test; (full comment #2 in ## Notes)
### comment #2 [2026-07-23 19:05] @claude
(fixed) 985d243 - pins + gate + wiring shipped; kit suite green (npm test exit 0) incl. new 14-case dispatch-guard test; bootstrap recomposed ~/.claude/CLAUDE.md; plugin dev-linked (active on /reload-plugins or next session). Follow-ups live in inbox: t.mjs CRLF frontmatter bug; Workflow-tool agent() calls are outside this gate (PreToolUse Task|Agent only).
