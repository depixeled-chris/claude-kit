---
name: scaffold-agent
description: Scaffold a project-local knowledge-agent at <repo>/.claude/agents/<domain>.md. Emits the standard shape (frontmatter + role/conventions/gotchas/out-of-scope/verify sections), pre-filled from what's already known about the domain. Use when a domain keeps recurring across delegations and needs a durable home for its conventions and past gotchas.
---

# scaffold-agent

Emit a project-local knowledge-agent for a recurring domain.

## When to use

A domain (render layer, simulation core, verification harness, backport boundary, etc.)
has been explained to delegated agents multiple times — either from the task prompt or
from CLAUDE.md. This skill creates a durable agent definition so future delegations
inherit conventions and gotchas automatically rather than re-deriving them.

The `/drain` and `/work` commands will suggest this when a domain recurs:
> `suggest: .claude/agents/<domain>.md not found — recurring delegations could share a
> knowledge-agent (use /scaffold-agent to create one)`

## What to pass

Provide the domain name (becomes the filename slug and `name:` frontmatter). Optionally
describe what the agent should cover — otherwise derive it from recent delegation history
and the codebase.

## What this skill does

1. Identify the domain from the argument or from the recurring delegation pattern.
2. Determine the agent's file path: `<repo>/.claude/agents/<slug>.md`.
3. Survey what already exists: read the relevant source files, CLAUDE.md sections,
   and recent ticket Notes to extract the real conventions + gotchas (don't invent).
4. Emit the file using the standard shape below.
5. Report what was written and suggest running `npm run build` / the project's verify
   command to confirm the agent definition is consistent with the live codebase.

## Standard shape

```markdown
---
name: <domain-slug>
description: <one-sentence: what this agent does, what files it owns, when to use it>
tools: <least-privilege list: Read, Grep, Glob, Edit, Bash — omit Write/WebSearch if not needed>
model: opus   # remove line if the default tier is fine
---

You implement / review / investigate the **<domain>** layer. Your turf is `<paths>`.
Read `CLAUDE.md` and `docs/CODEMAP.md` first; they hold the project rules and the
architectural seam.

## Conventions + gotchas you guard

- **<Invariant name>.** <What it is, why it exists, what breaks if violated.>
- <Repeat for each hard invariant or past showstopper.>

## Out of scope

- Don't touch `<sibling domain paths>` — that's `<sibling-agent>`'s turf.
- Don't edit `.ai/`, `docs/strategy/`, or hooks. Don't reclassify gift/scope status.
- If a fix traces to legacy or deprecated code outside this domain, STOP and surface
  it — don't expand scope unilaterally.
- If asked to do something outside this domain, decline and name the right agent.

## Verify

Always finish with `<verify command>` (e.g. `npm run build`, `cargo test`). Report
what you changed and the result.
```

## Rules for the generated agent

- **Location:** `<repo>/.claude/agents/<slug>.md` — committed to the project, never
  to claude-kit. This encodes project-private domain knowledge.
- **Conventions from evidence, not assumption.** Every gotcha bullet must trace to a
  real invariant in the codebase, a past showstopper in git history, or an explicit
  rule in CLAUDE.md. Don't pad with generic advice.
- **Least-privilege tools.** A read-only reviewer gets Read/Grep/Glob/Bash, not
  Edit/Write. Only grant Write if the agent creates new files.
- **Out-of-scope guard is mandatory.** Name the sibling domains and the right agents
  for them. The guard is the main defence against scope creep across delegations.
- **Keep it current.** When a new gotcha appears in session, add it here — treat a
  recurring per-session correction as a prompt bug to fix at the source.

## Exemplars

HOD's `.claude/agents/` has production examples of this shape:
- `hod-render.md` — render layer: merged-building material rule, lighting budget,
  facade UV order, mobile quality, sim boundary guard.
- `hod-sim-core.md` — pure sim: Three-free invariant, coordinate frame, determinism.
- `backporter.md` — open-core backport: gift boundary, runbook, gray-area protocol.
- `scope-reviewer.md` — read-only scope audit: three dispositions, classification.
