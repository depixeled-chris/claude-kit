---
description: Route an interjection into .ai/ without stopping current work
argument-hint: "[type] <text>"
---
Classify and route the following per the contract in CLAUDE.md and the taxonomy
in `.ai/config.yml`, WITHOUT stopping current work unless its `blocking` rule
fires. Emit a one-line receipt, then continue what you were doing.

Interjection: $ARGUMENTS
