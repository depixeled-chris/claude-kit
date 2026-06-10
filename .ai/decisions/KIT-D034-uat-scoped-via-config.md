---
id: KIT-D034
title: "UAT is scoped via config (`uat.default: required|none` + per-ticket override); claude-kit runs none"
date: 2026-06-10
supersedes:
source: maintainer interjections 2026-06-10 ("We need to be able to scope UAT via config with defaults. This project doesn't need UAT by default." · "You are more informed than I am on this particular project to do the UAT.")
---

**Decision:** Whether finished work requires HUMAN acceptance is a config knob, not a
universal rule. `.ai/config.yml` gains `uat.default: required|none`, overridable
per-ticket via frontmatter `uat:`. `required` (the TEMPLATE default): work parks in
`review` and only the human sets `done` (paired with `human_only: [done]`). `none`:
Claude closes work directly once every acceptance criterion passes WITH test evidence —
the KIT-T061 evidence floor moves to the closing transition and applies either way.
claude-kit itself runs `uat.default: none` with `human_only: []`.

Refines KIT-D033 (review IS the UAT stage; no separate status — unchanged): D033's
"present the queue frequently" clause applies to UAT-`required` projects; a `none`
project doesn't accumulate a queue to present.

**Why:** The maintainer's words, verbatim: "This project doesn't need UAT by default"
and "You are more informed than I am on this particular project to do the UAT." For
infrastructure the agent builds, tests, and dogfoods daily, routing acceptance through
a human who'd rubber-stamp it makes the queue a formality that rots (33 items deep at
the moment of this decision). Product-facing projects (HOD) keep `required` — there the
human IS the informed acceptor. Rejected: a per-type/priority rules engine (YAGNI — the
per-ticket frontmatter override covers exceptions without new machinery).
