---
id: KIT-T135
title: Codify the UAT/automated-test role split in the base contract + init-project
type: feature
status: done
priority: medium
milestone:
labels: [contract, init-project]
aka: []
parent:
introduced_by:
produced_by: KIT-D045
informs: []
links: [KIT-D045, KIT-T099]
files: [user-config/CLAUDE.global.md, project-template/CLAUDE.snippet.md, hooks/land-alert.mjs, hooks/land-alert.test.mjs]
tier:
model:
effort:
supersedes:
superseded_by:
created: 2026-07-23T10:22:26Z
updated: 2026-07-23T10:22:26Z
---

## Description
Bake KIT-D045 into the kit's deliverables so every adopted project reminds the
agent structurally, not from memory: automated tests are run and responded to
by Claude (its verification loop); the maintainer does UAT only; the KIT-T099
"what's testable" receipt must be UAT-shaped — a user-facing command or
experience, never "run pytest".

Origin: fountain-previz 2026-07-23 — turns ended by pointing the maintainer at
pytest commands; maintainer corrected the role split.

## Acceptance Criteria
- [x] Base CLAUDE.md contract (public base, testable-receipt rule) states the
      role split and defines the receipt as UAT-shaped, with the
      `[no-test: <reason>]` + already-run-evidence form for non-UAT-able work.
- [x] init-project emits the reminder into adopted projects' CLAUDE.md.
- [x] KIT-T099 land-alert gate docs/examples show UAT-shaped receipts, not
      test-suite commands.

## Plan
1. Reword the testable-receipt clause in the base contract source (claude-kit,
   not the composed ~/.claude/CLAUDE.md).
2. Thread the same wording through the init-project template.
3. Sweep KIT-T099 gate message/examples for "run the tests"-shaped phrasing.

## Notes
Receipt evidence split: automated results are cited as already-run facts
("116 passed", sha); the actionable line the maintainer gets is what THEY can
try as a user.

## History
- [2026-07-23 10:22] (created) captured via cap from fountain-previz session
- [2026-07-23 10:32] (status) todo → doing
- [2026-07-23 10:38] (comment) base contract: TESTABLE bullet split into UAT-receipt rule + automated-tests-are-Claude's rule; snippet: new "Verification roles (KIT-D045)" section; gate: TEST_RECEIPT gains \bUAT\b token, nag reworded, +1 test case
- [2026-07-23 10:38] (fixed) node hooks/land-alert.test.mjs — 15 tests ALL PASS (new case: UAT-shaped receipt with no legacy test token clears the gate)
- [2026-07-23 10:38] (status) doing → done (config.uat: none — evidence floor met; composed ~/.claude/CLAUDE.md refresh via bootstrap remains Chris's step per KIT-T099 precedent; views regen left to the session with in-flight .ai state)
