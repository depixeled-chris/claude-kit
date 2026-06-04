---
id: KIT-D016
title: ".claude/ persists in the PROJECT repo; .ai/ persists in claude-kit-data — both synced, link enforced not remembered"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04
---

**Decision:** An adopting project keeps durable workflow state in TWO synced stores, by design:
- **`.ai/`** is a symlink into `claude-kit-data/projects/<name>/` — tickets, inbox, decisions,
  notes, questions, SESSION. The shared workflow data repo.
- **`.claude/`** (agents/, memory/, README) is committed in the PROJECT's OWN git. It is NOT
  mirrored into claude-kit-data, and deliberately so: project-local agents must version WITH the
  code they guard (a code change and its guardian agent travel in one commit), and project memory
  travels with the project. Both reach every machine via that repo's normal clone/pull.
- The harness's machine-local auto-memory dir (`~/.claude/projects/<encoded>/memory/`) is unified
  into the committed `.claude/memory/` by a **symlink**, so memory writes land in the synced dir.

This is "lose nothing" (KIT-D015) for the `.claude/` side: it's persisted + cross-machine, just
in the project repo rather than claude-kit-data.

**Why:** The genuine failure mode is not WHERE the files live — it's that the unifying symlink is
a manual per-machine setup step. A fresh machine that skips it writes memory machine-locally and
silently loses it on the next pull/clear. Per KIT-D002 (enforced by hooks, not memory), the link
must be VERIFIED/created automatically, not remembered. Rejected: moving `.claude/` into
claude-kit-data for a single store — it would decouple guardian agents from the code they version
with, and tooling that belongs to the repo would live outside it. The enforcement gap is tracked
in KIT-T016.
