# Agent library

**Non-proprietary** subagent definitions, versioned here so they improve by
iteration in one place instead of being re-invented per project. The **plugin**
ships them to `~/.claude/agents/`; a project may also pin its own under
`.claude/agents/`.

## Rules
- **Non-proprietary only** (public + MIT). A generic role — researcher, code
  reviewer, refactorer, test author — belongs here. An agent that encodes a
  specific product's domain, private APIs, or commercial strategy stays in that
  project / the private overlay.
- **One agent per file:** `agents/<name>.md` with the standard frontmatter
  (`name`, `description`, `tools`) + the system prompt body.
- **Iterate in place.** When an agent misbehaves, fix the definition *here* and
  note what changed + why (so the improvement carries to every project). Treat a
  recurring correction as a prompt bug to fix at the source, not per-session.
- Keep tool grants **least-privilege** — a read-only researcher gets read/search
  tools, not Write/Edit. Tight `tools:` frontmatter is also a token lever: unused
  tool schemas never load into the agent's baseline (KIT-T030, lever 1).
- **Lean profile (KIT-T030):** each agent body carries a short *Operating context*
  digest (a handful of invariants + "read the relevant CLAUDE.md section on demand")
  instead of relying on the full global/project contract being inherited. claude-kit
  controls the digest and the toolset; whether the harness *also* injects the global
  CLAUDE.md, the project CLAUDE.md, and the skills catalog into a subagent's context
  is **harness-level** (no agent-frontmatter knob) — see
  `docs/research/agent-token-strategy.md` for the measured breakdown and the
  flagged harness follow-up.

## Mandatory status transitions (KIT-T028)
When an orchestrator delegates a **ticket** to a subagent, the subagent MUST keep the
ticket status current — a stale `doing` nags every session start and obscures what's
actually in flight. The three mandatory transitions:
- **Start**: `node <kit>/scripts/t.mjs status <id> doing` as the FIRST act.
- **Done** (all criteria pass): `node <kit>/scripts/t.mjs status <id> review` (or
  `done` when `config.uat` resolves `none`).
- **Bail / interrupted / reverted**: `node <kit>/scripts/t.mjs status <id> todo`
  before stopping — never leave the ticket `doing`.

The orchestrator briefs this rule in the agent's task prompt and the `/work` + `/drain`
commands enforce it in the main thread. Leaving a ticket `doing` on exit is a
process failure; the stale-doing detector (housekeeping + orient) will flag it loudly.

## Index
| Agent | Role | Tools |
| --- | --- | --- |
| [researcher](researcher.md) | Read-only investigation (codebase + web); returns sourced answers with pointers | Read, Grep, Glob, Bash, WebSearch, WebFetch |
| [code-reviewer](code-reviewer.md) | Reviews changes for correctness/security/maintainability; reports, doesn't fix | Read, Grep, Glob, Bash |
| [refactorer](refactorer.md) | Behavior-preserving restructure, verified with tests | Read, Grep, Glob, Edit, Write, Bash |
| [test-author](test-author.md) | Writes + runs real automated tests (red→green for bugs) | Read, Grep, Glob, Edit, Write, Bash |

## Project knowledge-agents (KIT-T015)

Generic agents (above) cover any codebase. But a domain that recurs across many
delegations — a render layer with hard invariants, a pure-simulation boundary,
a verification harness, an open-core backport boundary — should get its own
**project-local knowledge-agent** so every delegation inherits the conventions and
past mistakes instead of re-deriving them from scratch.

### Convention

- **Location:** `<repo>/.claude/agents/<domain>.md` — committed alongside the
  project, NOT added to claude-kit (these encode private domain knowledge).
- **Name:** the domain as a slug (`hod-render`, `hod-sim-core`, `backporter`,
  `scope-reviewer`).
- **Shape:** standard agent frontmatter (`name`, `description`, `tools`, optional
  `model`) + a body with four sections:
  1. Role — what this agent does and what files/subsystems it owns.
  2. Conventions + gotchas — the invariants and past showstoppers it guards.
  3. Out-of-scope / legacy guard — what it must NOT touch; when to stop and surface.
  4. Verify — how it confirms its work is correct (build command, test command, etc.).
- **Kept current:** when a gotcha is discovered in session, add it to the agent
  definition so the next delegation inherits it — treat a recurring per-session
  correction as a prompt bug to fix at the source.

### Exemplars (from `hustle-or-die/.claude/agents/`)

These HOD agents demonstrate the shape in production; use them as reference when
scaffolding a new project-local agent:
- `hod-render.md` — Three.js render layer: merged-building material rule, lighting
  budget, facade UV face order, mobile quality knobs, out-of-scope sim boundary.
- `hod-sim-core.md` — Pure simulation core: Three-free invariant, coordinate frame,
  determinism boundary, physics model.
- `hod-verify.md` — Verification harness: what the smoke/interaction test probes, the
  `window.__game` contract, how to read results.
- `backporter.md` — Open-core backport: gift boundary, runbook, gray-area protocol.
- `scope-reviewer.md` — Read-only scope audit: three dispositions, classification method.

### When to create one

When `/drain` or `/work` sees the same domain recur across multiple delegations with
no matching project agent, it will surface: `suggest: .claude/agents/<domain>.md not
found — recurring delegations could share a knowledge-agent`. Use `/scaffold-agent` to
emit the standard template, fill in the domain specifics, commit it to the project.

Once it exists, `/drain` and `/work` route matching delegations there automatically
instead of bare general-purpose — no re-explanation needed in each task prompt.
