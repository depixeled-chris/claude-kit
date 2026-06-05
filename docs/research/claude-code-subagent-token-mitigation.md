# Claude Code subagent token mitigation

**Question:** Why does every Task/Agent subagent start at ~58–79k tokens before doing any
work, and what concrete, Claude-Code-specific levers cut that baseline? ·
**Date:** 2026-06-05 · **Status:** 🔬 ready · proposed ROADMAP id: **R042**

---

## TL;DR

The single biggest, cheapest win is **MCP tool-search deferral**: connected MCP servers
(Gmail, Calendar, Drive, context7, etc.) should contribute only tool *names* to a
subagent's baseline, not full schemas — but that only holds if the subagent runs on a
**Sonnet 4 / Opus 4-class model** and `ENABLE_TOOL_SEARCH` is not disabled. If any of your
heavy subagents are on **Haiku**, or you're behind a non-first-party `ANTHROPIC_BASE_URL`
proxy or Vertex AI, tool search is **off** and every MCP schema loads into every spawn —
that alone explains a large chunk of an 18–30k tool-schema baseline. **Fix that first**,
then trim CLAUDE.md (the ~30k auto-injected line that hits *every* non-Explore subagent),
then route bulk subagents to Haiku and batch them.

Hard truths from the primary docs, so you don't chase dead ends:

- **You cannot make a custom subagent skip CLAUDE.md.** Only the built-in **Explore** and
  **Plan** agents skip CLAUDE.md + git status, and "there is no frontmatter field or
  per-agent setting to change which agents skip them." Every other built-in and custom
  subagent loads the **full memory hierarchy** (`~/.claude/CLAUDE.md`, project CLAUDE.md,
  `CLAUDE.local.md`, managed policy). So the only lever on CLAUDE.md cost is **making the
  files smaller** (or moving content to skills).
- **Subagent baselines are NOT cached across spawns the way you'd hope.** Each subagent
  "builds its own cache, starting with no cache hits on its first call," and subagents use
  the **5-minute TTL even on a subscription**. Back-to-back spawns *within 5 minutes in the
  same dir on the same model* can hit a warm cache; minutes-apart or model-switched spawns
  pay the full creation cost again.
- **A fork is the cache-friendly alternative to a fresh subagent** for same-context side
  tasks — it reuses the parent's prompt cache on its first request.

---

## Current state (this setup, measured)

KIT-T030 measured each Task-tool subagent starting at **~58–79k tokens before any work**,
composed of:

| Component | Measured | Controllable here? |
| --- | --- | --- |
| Built-in + MCP tool schemas | ~18–30k | **Yes** — tool search deferral + per-agent `tools:`/`mcpServers:` |
| Skills catalog | ~8–14k | Partially — skills load on demand; catalog listing is small, preloaded `skills:` is the cost |
| Global + project CLAUDE.md (auto-injected) | ~30k | **Yes, but only by shrinking the files** — no skip flag for custom agents |
| Memory index | (small) | Yes — keep `MEMORY.md` indexes one line per entry |
| Output style | (small) | Yes — fixed at session start |

We spawn **many** subagents. With subagents on the 5-minute TTL and frequently minutes
apart, much of that baseline is paid as **cache-creation** tokens (1.25× input rate)
rather than **cache-read** (0.1× input rate) — the worst-case billing.

---

## Findings

### 1. Exactly what loads into a non-fork subagent's context

Per the official sub-agents doc, a non-fork subagent's initial context is:

- **System prompt** — the agent's *own* prompt + environment details, **not** the full
  Claude Code system prompt. (Custom agents are leaner here than the main thread.)
- **Task message** — the delegation prompt the parent writes.
- **CLAUDE.md + memory** — *every* level the main conversation loads. **Explore and Plan
  are the only agents that skip this**, and there is no setting to change that.
- **Git status** — snapshot from session start; suppressed by `includeGitInstructions:
  false` or non-git dirs; Explore/Plan skip it regardless.
- **Preloaded skills** — full content of any skill named in the agent's `skills:` field
  (this *injects entire skill bodies*, so use it sparingly).
- **Tool definitions** — built-in tools the agent is allowed, plus MCP tools per the
  deferral rules below.

### 2. MCP tool schemas — the suspected large, easy win (confirmed)

- **Default = deferred.** "Tool search keeps MCP context usage low by deferring tool
  definitions until Claude needs them. Only tool names and server instructions load at
  session start." Enabled by default. This applies to subagents too — they inherit MCP
  tools, but those tools defer.
- **It silently turns OFF** in three cases, and then **all MCP schemas load upfront into
  every spawn**:
  - **Haiku models do not support tool search** (`tool_reference` blocks require Sonnet 4+
    / Opus 4+). So an Explore agent (Haiku) or any `model: haiku` subagent loads MCP
    schemas in full.
  - **Vertex AI** (disabled by default there for pre-Sonnet-4.5/Opus-4.5).
  - **Non-first-party `ANTHROPIC_BASE_URL`** (LLM gateways/proxies that don't forward
    `tool_reference`).
- **`alwaysLoad: true`** on a server (or `anthropic/alwaysLoad` on a tool) force-loads its
  schemas upfront regardless of deferral — audit `.mcp.json` for this.
- **Scope MCP out of the baseline entirely** with the per-agent `mcpServers:` frontmatter:
  servers you define *inline* in an agent connect only for that agent; servers you keep in
  `.mcp.json` are inherited by all. "To keep an MCP server out of the main conversation
  entirely and avoid its tool descriptions consuming context there, define it inline" in
  the agent that needs it. Conversely, omit a server from an agent's `mcpServers:` to deny
  it. `--strict-mcp-config` / `--bare` and managed `allowedMcpServers`/`deniedMcpServers`
  also filter subagent-declared servers (v2.1.153+).
- **CLI tools beat MCP for context**: "Tools like `gh`, `aws`, `gcloud` … are still more
  context-efficient than MCP servers because they don't add any per-tool listing." Prefer
  `gh` over a GitHub MCP, etc.

### 3. Per-agent `tools:` restriction — does it cut schema tokens?

Yes, for **built-in tools**: a bare deny rule on a built-in tool "removes that tool from
Claude's context entirely" (it lives in the system-prompt layer). Restricting an agent to
`tools: Read, Grep, Glob, Bash` drops the schemas for Write, Edit, WebFetch, etc. from that
agent's baseline. For **MCP** tools, deferral already keeps schemas out until used, so
`tools:`/`disallowedTools:` on MCP mostly affects *availability/safety*, not baseline
tokens — unless tool search is off (case 2 above), where restricting the agent's tool set
is the only way to shrink the upfront MCP load.

### 4. Skills catalog

Skills "inject their instructions as user messages at the point of invocation" — the
*catalog* (names/descriptions) is comparatively small and loads so the model can choose to
invoke. The real per-agent cost is the **`skills:` frontmatter**, which preloads *entire
skill bodies* at startup. Lever: **don't list `skills:`** on lean agents; let them invoke
on demand via the Skill tool. To block skills entirely, omit `Skill` from `tools:` or add
it to `disallowedTools:`. There is no documented flag to suppress the catalog listing
itself for a subagent; keep skill descriptions terse (they help selection anyway).

### 5. CLAUDE.md — the ~30k line hitting every spawn

- **No skip for custom agents** (see Finding 1). The only levers are size and placement:
  - The doc's explicit target: **"Aim to keep CLAUDE.md under 200 lines by including only
    essentials."**
  - **Move specialized instructions to skills** — "loaded into context at session start …
    those tokens are present even when you're doing unrelated work … Skills load on-demand
    only when invoked." Workflow-specific blocks (PR review, DB migration playbooks)
    belong in skills, not CLAUDE.md.
  - Cost scales roughly linearly with file size, and it's paid **per spawn** (each
    subagent reloads from disk). Halving CLAUDE.md halves that slice across *every* agent.
  - This project's CLAUDE.md is large (architecture + invariants + workflow contract). The
    `@.claude/memory/MEMORY.md` import and the `.ai/` workflow contract are prime
    candidates to split into an on-demand skill so they don't ride every subagent.

### 6. Model per subagent — cost lever

`model:` frontmatter accepts `sonnet`, `opus`, `haiku`, a full ID, or `inherit` (default).
Resolution order: `CLAUDE_CODE_SUBAGENT_MODEL` env → per-invocation param → frontmatter →
main model. **Route bulk/verbose subagents (search, log triage, test runs) to Haiku** for
the cheaper per-token rate — but note the tradeoff: **Haiku disables tool search**, so if
that agent needs MCP, its MCP schemas load upfront. Net win when the agent uses few/no MCP
tools (the common case for Explore-style work).

### 7. ToolSearch / deferred tools — does it lower the baseline?

Yes — that *is* the deferral mechanism in Finding 2. Default on for Sonnet/Opus. Threshold
mode `ENABLE_TOOL_SEARCH=auto` (or `auto:N`) loads schemas upfront only while they fit in
N% of context (default 10%) and defers the rest — useful if you want a few common tools hot
without a search round-trip. `ENABLE_TOOL_SEARCH=false` forces everything upfront (don't).
You can also `permissions.deny: ["ToolSearch"]` to remove the search tool itself.

### 8. Output style / verbosity / returning pointers

Output style is part of the system prompt, fixed at session start (cheap; changing it
mid-session doesn't even apply until restart). The real verbosity lever is **architectural**
(below): make subagents return *summaries and pointers* (path + line range), not file dumps
— "Running many subagents that each return detailed results can consume significant
context" (this hits the **parent's** context on every return).

### 9. Context-editing / compaction features

- **Subagent auto-compaction** triggers at ~95% capacity; lower it with
  `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` (e.g. `50`) so long-running agents compact earlier.
- **MCP output caps**: `MAX_MCP_OUTPUT_TOKENS` (default 25k; warns at 10k) bounds tool
  output bloat.
- **Hooks to preprocess**: a `PreToolUse` hook can grep a log before Claude sees it,
  cutting tens of thousands of tokens to hundreds.

### 10. Prompt caching for subagents — read it correctly

- **Layering** (prefix-matched, exact): system prompt (tools, output style) → project
  context (CLAUDE.md, memory) → conversation. A change in an earlier layer invalidates
  everything after it.
- **Subagents:** own cache, **no hits on first call**, **5-minute TTL even on a
  subscription** (the 1h TTL applies only to the main conversation; a known bug —
  anthropics/claude-code #36243 — confirms `ENABLE_PROMPT_CACHING_1H[_BEDROCK]` does **not**
  propagate to subagent requests). **Implication:** back-to-back spawns < 5 min apart, same
  dir, same model can warm-read each other's prefix; spawns minutes apart or on a different
  model miss and pay **cache-creation (1.25×)**. The issue estimates ~$1.60 extra per
  ~50-subagent session from this alone.
- **Cache scope** is per machine + working directory + model + effort. Parallel sessions in
  the **same dir** share cache; worktrees do **not** (different cwd) — relevant if you use
  `isolation: worktree`, which forfeits cache sharing.
- **Reading effectiveness:**
  - `/usage` (and `/cost`) shows session token totals and, on a plan, a **breakdown
    attributing usage to skills, subagents, plugins, and individual MCP servers** — use
    this to find which MCP server is eating the baseline.
  - `/context` shows *what's consuming space right now* — run it to see the tool/MCP/
    CLAUDE.md split directly.
  - Statusline `current_usage`: `cache_read_input_tokens` (good, ~10% rate) vs
    `cache_creation_input_tokens` (bad, write rate). **High read:creation = caching is
    working; persistently high creation = your prefix keeps changing** (model switches,
    MCP connect/disconnect, effort changes).
- **Forks** inherit the parent's system prompt + tools + history and **reuse the parent's
  cache on the first request** — cheaper than a fresh subagent when the side task needs the
  same context. `/fork <directive>` (default-on from v2.1.161; else
  `CLAUDE_CODE_FORK_SUBAGENT=1`).

### 11. Architecture — when NOT to spawn, and parallel vs sequential under the TTL

- **Don't spawn when baseline > task.** A subagent that reads two files and returns a
  10-line answer pays 58–79k baseline for a job the main thread (already-warm cache) does
  for near-zero marginal tokens. Use the main thread / `/btw` (no tools, answer discarded)
  for quick context-bound questions.
- **Batch many small tasks into one agent.** One subagent handed five related lookups pays
  the baseline **once**; five subagents pay it **five times**. Prefer a single agent with a
  task list over fan-out when subtasks are cheap.
- **Lean-orchestrator pattern.** Keep the parent thin: delegate verbose work, demand
  **pointers not dumps** back, and synthesize. Every detailed subagent return re-enters the
  parent's context.
- **Parallel vs sequential under the 5-min TTL.** Parallel spawns in the same dir/model can
  share a warm baseline cache (first one creates, others may read) and keep the window
  warm; **sequential spawns spaced minutes apart each miss and re-create**. If you must run
  many, run them **close together**, not drip-fed. Forks share the parent cache outright.
- **`isolation: worktree` costs cache** (separate cwd ⇒ separate prefix) — use only when
  isolation is worth the re-creation.

---

## Prioritized action plan (this setup)

**Do this first (highest impact, lowest effort):**

1. **Audit MCP deferral.** Run `/context` and `/usage` (note the per-MCP-server
   breakdown). Confirm tool search is **on**: no `ENABLE_TOOL_SEARCH=false`, no
   non-first-party `ANTHROPIC_BASE_URL`, not on Vertex. Grep `.mcp.json` and all agent
   frontmatter for `alwaysLoad: true` and remove any that aren't needed every turn.
   *Expected: collapses the 18–30k schema slice toward names-only for Sonnet/Opus agents.*

2. **Stop loading MCP into agents that don't need it.** For each custom subagent, either
   restrict with `tools:`/`disallowedTools:` or move rarely-used servers (Gmail, Calendar,
   Drive) out of global `.mcp.json` and inline them only in the one or two agents that use
   them via `mcpServers:`. *Expected: removes those servers from every other agent's
   baseline, and matters most for any Haiku agents where schemas would otherwise load
   upfront.*

**Then:**

3. **Shrink CLAUDE.md to < 200 lines.** Move the `.ai/` workflow contract and detailed
   invariant playbooks into an on-demand **skill**; keep CLAUDE.md to essentials +
   architecture line. Trim `MEMORY.md` to one line per entry. *Expected: cuts the ~30k
   line that hits every non-Explore spawn, roughly linearly.*

4. **Route bulk/verbose subagents to `model: haiku`** (search, log/test triage) where they
   use few/no MCP tools. *Expected: lower per-token cost; verify with `/usage` it didn't
   re-inflate via upfront MCP load.*

5. **Batch + lean-orchestrator.** Replace fan-outs of cheap subtasks with a single batched
   agent; mandate "return pointers (path + line range), not dumps." Run unavoidable
   parallel agents **close together** to share the 5-min warm cache; use **`/fork`** for
   same-context side tasks to ride the parent cache. *Expected: pays the 58–79k baseline
   once instead of N times.*

**Supporting toggles:** `includeGitInstructions: false` (drops git snapshot from agents);
`CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50` for long agents; `MAX_MCP_OUTPUT_TOKENS` to cap tool
output; consider `ENABLE_TOOL_SEARCH=auto` if you want a few hot tools without a search hop.

### The ONE change to make right now

**Verify MCP tool search is active and prune `alwaysLoad`/global MCP servers** so connected
servers (Gmail, Calendar, Drive, context7) contribute names-only — not full schemas — to
every subagent. It's a settings/`.mcp.json` change, no code, and directly attacks the
largest controllable slice of the 58–79k baseline. If any heavy agent runs on Haiku, either
move it to Sonnet or strip its MCP access, because Haiku can't defer.

---

## Open-core classification

This is **tooling/process research about Claude Code itself**, not engine or game code, and
lives in `claude-kit` (the cross-repo tooling kit), not in `hustle-or-die`'s open/closed
split. It does **not** touch `gta7` (public MIT) or any HOD simulation/render code, so the
public-living / frozen-snapshot / private taxonomy in `hustle-or-die/docs/strategy/scope.md`
doesn't apply to the doc's *subject*. **Gray area for the maintainer:** if any concrete
config produced from this (trimmed CLAUDE.md content, skill bodies, agent frontmatter) is
committed into `gta7`, that content inherits gta7's MIT terms — classify those artifacts at
commit time, default to private per the scope rule, and keep secrets/MCP credentials out of
anything public.

---

## Sources

- [How Claude Code uses prompt caching — Claude Code Docs](https://code.claude.com/docs/en/prompt-caching) — cache layering, 5-min vs 1-hour TTL, `ENABLE_PROMPT_CACHING_1H`, `FORCE_PROMPT_CACHING_5M`, `DISABLE_PROMPT_CACHING*`, subagents build own cache / 5-min TTL, fork reuses parent cache, cache scope per dir/model, `cache_read_input_tokens` vs `cache_creation_input_tokens`.
- [Create custom subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents) — what loads at startup, Explore/Plan skip CLAUDE.md (no override), frontmatter (`tools`, `disallowedTools`, `model`, `mcpServers`, `skills`, `effort`, `isolation`), model resolution + `CLAUDE_CODE_SUBAGENT_MODEL`, inline-MCP-to-keep-out-of-parent, `--strict-mcp-config`, `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`, forks.
- [Connect Claude Code to tools via MCP — Claude Code Docs](https://code.claude.com/docs/en/mcp) — Tool Search default-on, `ENABLE_TOOL_SEARCH` values (`true`/`auto`/`auto:N`/`false`), Haiku/Vertex/proxy unsupported, `alwaysLoad`, `permissions.deny: ["ToolSearch"]`, `MAX_MCP_OUTPUT_TOKENS`.
- [Manage costs effectively — Claude Code Docs](https://code.claude.com/docs/en/costs) — `/usage` per-skill/subagent/MCP breakdown, "keep CLAUDE.md under 200 lines," move instructions to skills, prefer CLI over MCP, `model: haiku` for simple subagents, agent-team ~7× cost, hooks-as-preprocessors.
- [Lessons from building Claude Code: Prompt caching is everything — Anthropic](https://claude.com/blog/lessons-from-building-claude-code-prompt-caching-is-everything) — design rationale for deferred tool loading, plan mode, compaction.
- [Introducing advanced tool use on the Claude Developer Platform — Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use) — tool-search/`tool_reference` mechanism behind deferral.
- [BUG #36243: ENABLE_PROMPT_CACHING_1H_BEDROCK does not apply 1h TTL to subagent requests — anthropics/claude-code](https://github.com/anthropics/claude-code/issues/36243) — confirmed subagents stay on 5-min TTL; ~$1.60 extra per ~50-subagent session.
- [Cache read tokens consume usage quota — CLAUDE.md re-reads (#24147) — anthropics/claude-code](https://github.com/anthropics/claude-code/issues/24147) — CLAUDE.md size scaling per request.
