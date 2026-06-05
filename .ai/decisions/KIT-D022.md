---
id: KIT-D022
title: "Model selection scales with task complexity/breadth — Opus (planning) / Sonnet (atomic) / Haiku (mechanical)"
date: 2026-06-05
supersedes:
source: conversation 2026-06-05 (maintainer)
links: [KIT-T030, KIT-T034]
---

**Decision:** The model used for a task is chosen by the **breadth of scope and amount of
consideration** the task needs, not by default-to-Opus:
- **Opus** — big planning, architecture, research, epics, anything reasoning-heavy.
- **Sonnet** — normal atomic code changes / bug fixes (the everyday default for subagents).
- **Haiku** — basic data formatting/cleanup, mechanical edits, search, test/log triage.

The orchestrator sets the model per dispatch (the Agent `model` param), and tickets carry a
`model:` tag to drive it (see KIT-T034). Default-to-Opus for every subagent was the dominant
token bleed.

**Why:** Maintainer (2026-06-05): "Big planning tickets should land on Opus. Small, atomic
changes should land on Sonnet … we might even go lower for really basic data
formatting/cleanup. The breadth of the scope and the amount of consideration needed to
accomplish the task should dictate which model is used." Quantified in
docs/research/claude-code-subagent-token-mitigation.md (subagents inherit the parent model;
Opus-inheritance multiplied cost across every spawn).
