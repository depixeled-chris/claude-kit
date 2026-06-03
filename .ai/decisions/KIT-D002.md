---
id: KIT-D002
title: "Public kit + private overlay"
date: 2026-06-02
---

Decided: the kit is public + MIT and holds NON-proprietary content only. Anything
sensitive — personal CLAUDE.md rules, proprietary product strategy/research, private
agents — lives in a separate **private overlay** (a private repo or a gitignored
`~/.claude/private/`). `bootstrap.sh` composes public + private.
Rejected: one public file scrubbed by hand each time. Why: a structural boundary means
secrets cannot reach the MIT repo by construction, instead of relying on the author (or
Claude) to scrub correctly every time.
