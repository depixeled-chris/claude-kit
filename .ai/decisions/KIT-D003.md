---
id: KIT-D003
title: "Enforcement hooks are portable Node, installed globally but opt-in-aware"
date: 2026-06-02
---

Decided: hooks are written in Node, installed once per machine from the kit, and
`exit 0` immediately unless the project has `.ai/`. "Global install" then never
interferes with unadopted projects, and nothing is copied into individual repos.
Rejected: bash/OS-shell hook scripts; per-project hook copies. Why: bash hooks hit
Windows/MSYS + Python path bugs and a heredoc-stdin bug that silently disabled a hook
(observed directly); Node is portable. Per-project copies = "two places" to maintain.
