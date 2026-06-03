---
id: KIT-D010
title: "git working-tree state is part of the tracked record; orient surfaces it on resume"
date: 2026-06-03
---

Decided: git **status / history / unpushed commits / local-only branches are first-class
parts of the tracked record** — not separate from, or secondary to, the `.ai/` files. Being
in GitHub is not the arbiter of "tracked." A resume must read the **working-tree reality**
and reconcile it against the plan, because context can clear mid-work (unplanned), leaving
uncommitted/unpushed work the written record doesn't mention.

Mechanism: the `orient` SessionStart hook now emits a **working-tree temperature** —
uncommitted + unpushed + local-only commits across (a) the project repo, (b) its data repo
(the `.ai` junction target), and (c) any `config.yml` `watch_repos` (e.g. a backport
target like gta7). `/prime` explicitly reconciles that against the plan and surfaces drift
(work on disk the plan omits, or vice-versa).

Why: the maintainer's framing — "whether something is in GitHub shouldn't be the driving
factor; git history + status ARE part of the system." The anti-amnesia guarantee has to
cover in-flight local work, not just committed/pushed state. Verified live: orient surfaced
the held gta7 `backport/sim-seam` (4 unpushed) + an uncommitted `.ai` config edit.

Source: conversation 2026-06-03.
