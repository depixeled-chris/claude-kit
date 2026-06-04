---
id: KIT-T015
title: Repeatable project-knowledge-agent pattern — drain suggests + routes to project-local agents
type: feature
status: todo
priority: medium
milestone:
labels: [agents, drain, orchestration, pattern]
links: [KIT-D015]
files:
  - commands/drain.md
  - skills/
  - agents/
created: 2026-06-04T11:27:00Z
updated: 2026-06-04T11:27:00Z
---

## Description
Make "stand up a project-local knowledge-agent" a first-class, repeatable claude-kit pattern —
generic enough that ANY adopting project gets it, while the agents themselves live in the
PROJECT (`<repo>/.claude/agents/`), never in claude-kit. claude-kit ships generic agents
(researcher/refactorer/test-author/code-reviewer); project-specific gotchas + conventions belong
to the project. The pattern is the connective tissue: how/when these get created and used.

The need: a domain that keeps recurring (e.g. a render layer with hard gotchas, a pure
determinism boundary, a verification harness) is re-explained to every fresh general-purpose
agent via copy-pasted guards. A project-local knowledge-agent carries that natively, so
delegations inherit the conventions + past mistakes instead of re-deriving them.

## Acceptance Criteria
- [ ] The drain/orchestration contract instructs the orchestrator to (a) SUGGEST creating a
      project-local knowledge-agent when a domain recurs across delegations, and (b) ROUTE
      delegations to the matching project agent when one exists (instead of bare general-purpose).
- [ ] A documented convention: project knowledge-agents live in `<repo>/.claude/agents/`, named
      by domain, and encode conventions + known gotchas + a guard section; they are NOT added to
      claude-kit. (Reference exemplars: HOD's backporter/scope-reviewer.)
- [ ] A scaffold/template (or skill) for authoring one, so it's repeatable, not ad-hoc.
- [ ] The legacy-code / out-of-scope guard is part of the standard agent-handoff template.

## Plan
1.

## Notes
- 2026-06-04: Filed alongside KIT-D015. Maintainer: "If it's HOD specific, it needs to be part of
  the project, not claude-kit" + "that needs to be a repeatable pattern across projects." First
  application: HOD gains hod-render / hod-sim-core / hod-verify / hod-rust-convergence in its own
  .claude/agents/ this session.
