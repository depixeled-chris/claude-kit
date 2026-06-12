---
id: KIT-T015
title: Repeatable project-knowledge-agent pattern — drain suggests + routes to project-local agents
type: feature
status: done
priority: medium
milestone:
labels: [agents, drain, orchestration, pattern]
links: [KIT-D015]
files:
  - commands/drain.md
  - skills/
  - agents/
created: 2026-06-04T11:27:00Z
updated: 2026-06-12T15:19:21Z
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
- [x] The drain/orchestration contract instructs the orchestrator to (a) SUGGEST creating a
      project-local knowledge-agent when a domain recurs across delegations, and (b) ROUTE
      delegations to the matching project agent when one exists (instead of bare general-purpose).
- [x] A documented convention: project knowledge-agents live in `<repo>/.claude/agents/`, named
      by domain, and encode conventions + known gotchas + a guard section; they are NOT added to
      claude-kit. (Reference exemplars: HOD's backporter/scope-reviewer.)
- [x] A scaffold/template (or skill) for authoring one, so it's repeatable, not ad-hoc.
- [x] The legacy-code / out-of-scope guard is part of the standard agent-handoff template.

## Plan
Scoped 2026-06-12 (drain). No blocking dependency; the pattern is already demonstrated
(HOD's `.claude/agents/` hod-render / hod-sim-core / hod-verify / backporter / scope-reviewer).
Pure docs/contract + a scaffold — no code logic, low risk.
1. **Orchestration rule** in `commands/drain.md` + `commands/work.md`: (a) when a domain recurs
   across delegations, SUGGEST standing up a project-local knowledge-agent; (b) when a matching
   `<repo>/.claude/agents/<domain>.md` exists, ROUTE the delegation there instead of bare
   general-purpose. (Folds in the "pick the RIGHT kit agent, not default general-purpose" note.)
2. **Convention doc** (section in `agents/README.md`): project knowledge-agents live in
   `<repo>/.claude/agents/`, named by domain, encode conventions + known gotchas + a guard
   section; they are NOT added to claude-kit. Reference the HOD exemplars.
3. **Scaffold**: a template (or a tiny `/scaffold-agent` skill) emitting the standard shape
   (frontmatter name/description/tools; body: role, conventions, gotchas, out-of-scope guard).
4. **Handoff template**: fold the legacy-code / out-of-scope guard into the standard delegation
   brief boilerplate so every handoff carries it.
Verification: `[no-test]` (docs/contract) — exit proof is a doc-audit-style check that the new
commands/sections reference real paths + the cited exemplars exist.

## Notes
- [2026-06-05 20:16] (comment) folded from triage: drain/orchestration should pick the RIGHT claude-kit agent for each task (researcher/refactorer/test-author/code-reviewer/etc.), not default to general-purpose; AND when a task needs a persistent section of domain knowledge, proactively SUGGEST a dedicated knowledge-holding subagent. Bake both into the orchestration process (folds into the subagent-orchestration feature)
- 2026-06-04: Filed alongside KIT-D015. Maintainer: "If it's HOD specific, it needs to be part of
  the project, not claude-kit" + "that needs to be a repeatable pattern across projects." First
  application: HOD gains hod-render / hod-sim-core / hod-verify / hod-rust-convergence in its own
  .claude/agents/ this session.
- [2026-06-12] Implemented. Added: `PICK THE RIGHT AGENT` + `SUGGEST A KNOWLEDGE-AGENT` rules to
  `commands/drain.md`; routing rule + standard handoff guard (out-of-scope/legacy) to
  `commands/work.md`; `## Project knowledge-agents` convention section to `agents/README.md`;
  new `skills/scaffold-agent/SKILL.md` skill + indexed in `skills/README.md`.
  Reference-existence check: HOD exemplars verified at `D:\dev\hustle-or-die\.claude\agents\`
  (hod-render.md, hod-sim-core.md, hod-verify.md, backporter.md, scope-reviewer.md,
  hod-rust-convergence.md — all present). Generic agents researcher/refactorer/test-author/
  code-reviewer verified in `agents/`. Commands drain.md and work.md verified in `commands/`.
  Skills claude-kit/doc-audit/release-checklist verified in `skills/`. All cited paths real.
  `npm test` exit 0. [no-test: docs/contract pattern; verified by reference-existence check]

## History
- [2026-06-12 15:14] (status) todo → doing
- [2026-06-12 15:18] (comment) ticked: The drain/orchestration contract instructs the orchestrator to (a) SUGGEST creating a
- [2026-06-12 15:18] (comment) ticked: A documented convention: project knowledge-agents live in `<repo>/.claude/agents/`, named
- [2026-06-12 15:18] (comment) ticked: A scaffold/template (or skill) for authoring one, so it's repeatable, not ad-hoc.
- [2026-06-12 15:18] (comment) ticked: The legacy-code / out-of-scope guard is part of the standard agent-handoff template.
- [2026-06-12 15:19] (status) doing → review
- [2026-06-12 15:19] (status) review → done
