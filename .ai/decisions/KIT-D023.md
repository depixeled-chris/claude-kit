---
id: KIT-D023
title: "Trunk-based by default — work on main, no feature branches unless opted-in per-project or a genuinely big/risky refactor"
date: 2026-06-05
supersedes:
source: conversation 2026-06-05 (maintainer)
links: [KIT-D020]
---

**Decision:** Default git workflow is **trunk-based: commit straight to `main`.** Do NOT
create or work in a feature branch unless (a) the maintainer opts in for that specific
project, or (b) there's a genuinely big reason — a large, risky refactor that needs
isolation. A normal ticket or fix lands on `main`. When a branch IS justified, merge it
back the instant the work is mergeable; never let a branch linger or silently park work
off-trunk.

**Why:** Maintainer (2026-06-05), verbatim: "The default behavior needs to be to not work
in feature branches. Unless I otherwise specify on a per project basis we should not be
working in feature branches unless there is a really good reason. Like a really big
refactor or something like that." The trigger: the claude-kit status-routing fix
(KIT-T036) and a large body of in-flight KIT work had been sitting on
`kit-t030-lever1-lean-agent-profile`, invisible to a single-repo "status" reading and not
live on any machine because it was never merged. Long-lived branches make status go blind
(the very failure that prompted this — see KIT-T036) and delay shipping. Trunk-based keeps
the remote `main` as the always-current source of truth.

**Mechanics:**
- Global contract source: `user-config/CLAUDE.global.md` — new first bullet under
  `# GIT WORKFLOW` stating the trunk-based default + the two opt-out conditions.
- Ships to every machine via `bootstrap.sh` composing `~/.claude/CLAUDE.md` from the
  base; live on next `/plugin update` + bootstrap.
- Per-project override mechanism: a project may declare it works in branches in its own
  CLAUDE.md / `.ai/config.yml`; absent that, trunk-based holds.
