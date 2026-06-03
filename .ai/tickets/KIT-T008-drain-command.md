---
id: KIT-T008
title: /drain command — broad auto-pull queue draining (no ticket id), distinct from /work
type: feature
status: review
priority: medium
labels: [command, drain, workflow]
links: [KIT-T005]
aka: [drain, work the queue]
files:
  - commands/drain.md
  - commands/work.md
created: 2026-06-03T22:30:00Z
updated: 2026-06-03T22:30:00Z
---

## Description
The maintainer wants to "start the drain broadly" without naming tickets. `/work` only took a
specific id; there was no broad entry point. Add `/drain`: pull and work the next item(s)
automatically per `.ai/config.yml` → `drain` (resume `doing`, then roadmap/milestone order,
then backlog by priority), running the `/work` contract on each item, looping item→review→next
until the queue is empty / every remaining item needs the maintainer / they stop. Kept DISTINCT
from `/work` (single targeted ticket); `/work` with no id points to `/drain` rather than guessing.

## Acceptance Criteria
- [x] `commands/drain.md`: selects next item per `drain` config (doing → roadmap/milestone →
      backlog priority), works it via the `/work` contract, loops on `review` to the next item,
      respects `auto_execute` boldness, stops + reports when the queue needs the maintainer.
- [x] `/drain` arg handling: none = current milestone then backlog; `all` = pure priority;
      a milestone name = that milestone only.
- [x] `commands/work.md`: no-arg points to `/drain` (no guessing) — the two stay disambiguated.

## Notes
- 2026-06-03: Built. Disambiguation (maintainer): `/work <id>` = deliberate single pick, stops at
  review; `/drain` = continuous auto-pull, same per-item contract, stops when the queue needs you.
- Activation: new/edited command files load on `/reload-plugins` or a fresh session. In plain
  language ("drain the queue") the behavior already follows from the CLAUDE.md drain contract
  even before the command file registers.
