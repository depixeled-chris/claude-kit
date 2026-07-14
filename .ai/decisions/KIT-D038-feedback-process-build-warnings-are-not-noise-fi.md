---
id: KIT-D038
title: (feedback/process) BUILD WARNINGS ARE NOT NOISE — fix them, don't wave them off as 'pre-existing/unrelated'. FAILURE (2026-06-06): the hod-chunkgen console_error_panic_hook cfg warning appeared in MY cargo check/build:wasm output MULTIPLE times; I dismissed it as pre-existing each time, then AMPLIFIED it by adding build:wasm to the dev script so it hit the maintainer's npm-run-dev startup. RULES: (1) verification must be WARNING-CLEAN — a warning in build/check output is a finding to fix or explicitly justify, never ignore; (2) NEVER route a noisy build into the dev/user path — if you add a build step to dev, its output must be clean first; (3) 'pre-existing' is not a pass — if I touch/surface it, I own it. Consider a clean-build check (cargo warnings = fail). Cross-project. Project: KIT.
date: 2026-07-14
supersedes:        # DEC-### this replaces, or blank
source:            # commit hash / doc path / "conversation YYYY-MM-DD"
---

**Decision:** <what was decided>

**Why:** <the reason — and what was rejected, and why>

<!-- One decision per file (atomic, like a ticket — KIT-D009). IDs KIT-D### (e.g. KIT-D010),
     assigned in order, never reused. Allocate with next-id.mjs (KIT-T009). Append a NEW
     file to supersede an old one; never edit a settled decision's substance. The orient hook
     surfaces recent decisions each session. Cite the id in commits where relevant. -->
