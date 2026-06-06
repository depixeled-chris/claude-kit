---
id: KIT-D027
title: "AGENT ORCHESTRATION (standing, RECONCILED): never panic-kill a running agent over a transient/mid-edit error — diagnose first; REVERTING uncommitted work is a LAST resort (git diff/stash/recover before any revert); commit frequently so work can't be lost. Worktree isolation is OPTIONAL, not required."
standing: true
scope: agents
date: 2026-06-06
supersedes:
source: conversation 2026-06-05/06 (maintainer correction); inbox cap 2026-06-06-0241
links: []
---

**Decision:**
- **Do NOT reactively kill a running agent** over a transient or in-progress error (e.g. a mid-edit HMR/build error). The live build self-heals when the agent finishes; diagnose before acting. Killing a local agent can revert its uncommitted work — that is how a near-complete rebuild was lost.
- **Reverting WIP is a LAST resort.** A path bug can just be fixed. Before any revert: `git diff`/`git stash`/dangling-commit recovery (`git fsck`) — be DAMN sure a revert is needed first.
- **Commit work frequently** so it can't be lost to a kill/transient.
- **Worktree isolation (`Agent isolation:'worktree'`) is OPTIONAL** — use it only when parallel agents would genuinely conflict on the working tree. It is NOT a blanket requirement for code-editing agents.

**Why:** A cap (2026-06-06-0241) proposed TWO rules: (1) don't panic-kill / reverting is last resort, and (2) MANDATORY worktrees for any code-editing agent. Rule (1) is confirmed standing guidance. Rule (2) was **explicitly REJECTED by the maintainer** ("they don't work nor do they need to work in isolated worktrees… a simple path bug can just be fixed and anything can be reverted, but you should be DAMN sure you need to revert first… reverting is a last resort"). This decision records the reconciled truth so the rejected mandatory-worktree rule is not re-adopted from the raw cap.
