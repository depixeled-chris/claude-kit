---
id: KIT-D029
title: "Glance command is /standup; /status is deleted (collides with the native built-in)"
date: 2026-06-09
supersedes:
source: conversation 2026-06-09 (full-plugin process review)
---

**Decision:** The kit ships ONE read-only glance verb: `/standup`. `commands/status.md`
is deleted (executed in KIT-T068). /standup's doc is corrected to match its actual
behavior (`survey.mjs --brief`).

**Why:** /standup and /status were verbatim duplicates (both run `survey.mjs --brief`),
and Claude Code has a NATIVE `/status` built-in (version/model/account panel), so the
kit's /status was shadowed — invocable only as the namespaced `/claude-kit:status`.
Keeping the colliding name buys nothing and costs system-prompt tokens every session.
Rejected: keeping both and differentiating later (adds work instead of removing it);
keeping /status for discoverability (the collision kills exactly that).
