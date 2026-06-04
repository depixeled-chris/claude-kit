# Agent token strategy — cutting the per-agent BASELINE (KIT-T030)

> **Dimension:** the FIXED context every freshly-dispatched agent pays *before any work*.
> Distinct from KIT-T020 (handoff-prompt economy) and KIT-T029 (script handoff). Those
> shrink the *task* payload; this shrinks the *baseline* every agent inherits regardless of
> task. Reconciled below — no overlap.

## TL;DR

Background subagents arrive at **~58–76k tokens before doing anything** because the harness
injects, into *every* agent's fresh window: the full system prompt + **all tool schemas**,
**both** CLAUDE.md files (global engineering contract + the 20k project file), the memory
index **twice** (project copy + machine-local auto-memory copy), the available-skills
catalog, and — for top-level sessions — the orient SessionStart block. Tool schemas + the
skills catalog + CLAUDE.md are the bulk. The single biggest controllable lever is **giving
subagents a lean profile**: a scoped agent does NOT need the full global contract, the
20k game-architecture CLAUDE.md, the duplicated memory index, or the orient block.

## Measured breakdown (bytes → tokens @ ~4 chars/tok for prose, ~3 for JSON schemas)

| Contributor | Bytes | ~Tokens | Auto-injected? | Controllable? |
|---|---:|---:|---|---|
| **Tool schemas** (10 loaded full + ~25 deferred names + MCP) | — | **~18–30k** | yes, every agent | partial (defer more; lean toolset per agent) |
| **Skills catalog** (the available-skills block: ~70 skills w/ descriptions) | — | **~8–14k** | yes, every agent | yes (don't expose skills to scoped subagents) |
| Global `~/.claude/CLAUDE.md` (engineering contract) | 9,438 | ~2.4k | yes | yes (drop for subagents) |
| Project `hustle-or-die/CLAUDE.md` | 20,012 | ~5.0k | yes | yes (drop/trim for subagents) |
| Project `claude-kit/CLAUDE.md` | 4,403 | ~1.1k | yes | yes |
| Memory index `MEMORY.md` (project copy, via `@`-import) | 2,258 | ~0.6k | yes | yes |
| Memory index AGAIN (machine-local auto-memory `MEMORY.md`) | ~2,200 | ~0.6k | yes | yes — **pure duplicate** |
| orient.mjs output (git log 12 + SESSION 40L + ROADMAP 50L + DECISIONS 25L + WIP + lineage) | ~6–10k | ~1.5–2.5k | **top-level only** | yes |
| Harness system prompt (identity, env, rules) | — | ~3–5k | yes | no (fixed) |
| **`.ai/config.yml`** (CLAUDE.md says "read at session start") | 8,457 | ~2.1k | only if the agent obeys & reads it | yes |

**Reconciliation of the 58–76k:** system prompt (~4k) + tool schemas (~18–30k) + skills
catalog (~8–14k) + 2× CLAUDE.md (~7.4k) + memory index ×2 (~1.2k) + orient (~2k, top-level)
+ the handoff/task prompt itself (~5–15k, KIT-T020's dimension). The **floor an agent pays
before reading its task** is ~40–55k from harness+schemas+skills+CLAUDE.md+memory; the task
prompt pushes it to 58–76k. The variance (58 vs 76) tracks **how big the handoff prompt and
how many tool schemas** the agent's profile loads.

### Key findings

1. **Tool schemas + the skills catalog are the largest single bucket (~26–44k combined)** and
   are paid by *every* agent including read-only researchers. The deferred-tool mechanism
   (ToolSearch) already helps — only ~10 tools ship full schemas, the rest are name-only — but
   the ~70-entry **skills catalog ships in full to agents that will never invoke a skill**.
2. **The memory index is injected twice** — once via the project `@.claude/memory/MEMORY.md`
   import and once from the machine-local auto-memory `MEMORY.md`. These are byte-identical.
   Pure waste (~0.6k), trivially fixable, and a smell that the two stores aren't unified.
3. **Good news, corrects a suspicion in the ticket:** `@.claude/memory/MEMORY.md` imports
   only the ~2.3k *index*, NOT the 17 sub-files (28.9k total). Those are markdown links, not
   `@`-imports, so they load on demand. Memory is **not** the whale the ticket feared — the
   index is cheap; the 26k of bodies stay out unless an agent reads them.
4. **orient is top-level-only** (SessionStart fires for the session, not Task-tool subagents),
   so subagents already skip the ~2k orient block. But subagents still inherit **both full
   CLAUDE.md files** — including the 20k HOD game-architecture file that a claude-kit tooling
   agent has zero use for, and vice-versa.
5. **The 20k HOD CLAUDE.md is the heaviest static file** and is almost entirely
   game-simulation architecture (coordinate frames, vehicle physics, lighting budget). A
   subagent dispatched for a *tooling/token/docs* task pays 5k tokens for irrelevant
   game-engine lore on every dispatch.

## Ranked levers (highest leverage first)

### Lever 1 — Lean subagent profile: don't inherit the full baseline (biggest win, ~12–25k/agent)
A scoped subagent gets an explicit task; it does not need the full global engineering contract,
the 20k project-architecture CLAUDE.md, the duplicated memory index, or the skills catalog.
- **Trim the skills catalog out of subagent context** (~8–14k). A researcher/refactorer agent
  doesn't dispatch skills. This is the single largest controllable cut.
- **Give project agents a SHORT system prompt + a one-line pointer to CLAUDE.md** instead of
  inheriting the whole 20k+9.4k. The agent reads the relevant CLAUDE.md *section* on demand
  (scoped read) only if its task touches that area. Net: replace ~7.4k of always-on contract
  with a ~0.3k pointer + on-demand reads.
- **Per-agent toolsets** (already supported via the agent frontmatter `tools:` field — see
  `agents/researcher.md` `tools: Read, Grep, Glob, Bash, WebSearch, WebFetch`). Tighten every
  agent to its minimal toolset so unused schemas never load. Edit/Write agents don't need
  WebFetch; researchers don't need Write/Edit.
- **Expected saving: ~12–25k tokens per subagent dispatch.**

### Lever 2 — Provenance-by-reference + query-the-cache (KIT-T020/T004/T026), ~5–15k/agent
Don't paste whole research/audit/ticket docs into the handoff or have the agent read them
whole. The agent receives **pointers** (ticket id + `file:line` ranges) and **queries the
SQLite cache** (KIT-T004 built it; KIT-T026 must make orient/drain/handoff *consume* it) for
ticket bodies, recent activity, and provenance — instead of scanning markdown into context.
This is KIT-T020's dimension; T030 adds: the cache query result is *also* a baseline-shrinker
because it replaces "read the 20k doc to orient" with "query the 3 rows you need."
- **Depends on KIT-T026** (consume the cache) landing — currently the cache is hydrated but
  unused.
- **Expected saving: ~5–15k per agent that would otherwise read whole docs.**

### Lever 3 — Scoped line-range reads + structured returns, ~3–10k/agent
- Agents read **spans, not files** (`Read offset/limit`, `Grep -n` pointers). The researcher
  agent prompt already mandates "pointers, not payloads" — extend that contract to all agents
  and to what the orchestrator ingests *back*.
- **Cap orient's slices** (it already caps: 12 commits / 40 SESSION / 50 ROADMAP / 25
  DECISIONS lines). For top-level only; fine as-is, but make orient query the cache (KIT-T026)
  rather than `readFileSync` whole files then slice.
- **Expected saving: ~3–10k, mostly on the return path (orchestrator re-ingest).**

### Also: dedup the memory index (~0.6k, trivial)
Unify the machine-local auto-memory `MEMORY.md` with the committed `.claude/memory/MEMORY.md`
(the symlink already documented in `.claude/README.md`) so the index isn't injected twice.
Small, but removes a duplicate and a divergence risk.

## Recommended subagent-context config

Subagents should inherit a **lean profile**, not the interactive-session baseline:

```
subagent baseline (target):
  system prompt:        keep (fixed)
  tool schemas:         minimal per-agent toolset only (frontmatter `tools:`)
  skills catalog:       OMIT (subagents don't dispatch skills)
  global CLAUDE.md:     OMIT; replace with 1-line pointer in the agent system prompt
  project CLAUDE.md:    OMIT full; inject only a ~10-line "invariants" digest +
                        a pointer to read the relevant section on demand
  memory index:         single copy, on-demand (agent reads MEMORY.md if its task needs it)
  orient block:         already absent for subagents — keep it that way
  task/handoff:         pointers + cache queries (KIT-T020 lean template), not inline dumps
```

Mechanism options (in order of harness-support confidence):
1. **Per-agent `tools:` frontmatter** — already supported, already used by `researcher.md`.
   Audit all 4 agents (`code-reviewer`, `refactorer`, `researcher`, `test-author`) for minimal
   sets. Zero new infra.
2. **A `digest` CLAUDE.md for agents** — a ~10-line invariants file that agent system prompts
   reference instead of the full 20k+9.4k. Keep the full files for the interactive session.
3. **Confirm/adjust harness CLAUDE.md inheritance** — verify whether the harness can be told
   subagents skip global/project CLAUDE.md auto-injection; if not configurable, lean on the
   digest pointer (option 2) so the contract is reachable but not always-on.

## Projected savings

| Profile | Before | After (levers 1–3) |
|---|---:|---:|
| Read-only researcher subagent | ~58–70k | **~28–38k** |
| Edit/refactor subagent | ~65–76k | **~35–45k** |

Roughly **a 35–45% baseline cut per subagent dispatch**, dominated by Lever 1 (skills catalog
+ CLAUDE.md + per-agent toolsets). Levers 2–3 compound it and shrink the *return* path.

## Reconciliation with sibling tickets (no duplication)

- **KIT-T020** (token-efficient handoffs): owns the *handoff-prompt* + provenance-by-reference
  dimension. T030 cites it as Lever 2 and adds the orthogonal *baseline* dimension.
- **KIT-T004 / KIT-T026** (SQLite cache build / consume): the cache is the substrate for
  Lever 2/3 (query, don't scan). T030 does not re-spec it — it depends on T026 landing.
- **KIT-T029** (script-based handoff): programmatic collate/record so the orchestrator ingests
  less. Complementary to T030's baseline cut; T030 doesn't touch the script mechanism.
- **KIT-T028** (mandatory status updates): unrelated to baseline; noted only because lean
  agents must still record status (cheap, via script per T029).

## Sources

All figures from `wc -c` on the live files (2026-06-04). Token estimates use ~4 chars/token
for prose, ~3 for JSON tool schemas. Tool-schema and skills-catalog token counts are estimated
from the injected blocks (not byte-measurable from disk); they are the largest bucket and the
prime candidate for measurement instrumentation in a follow-up.
