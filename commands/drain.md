---
description: Drain the queue — pull and work the next item(s) automatically, no ticket id needed
argument-hint: "[milestone | all]  (optional; default: current milestone, then backlog)"
---
Drain work per `.ai/config.yml` → `drain`, so the maintainer never has to name a ticket.
Keep going item-to-item until the queue needs them or they stop.

1. SELECT the next item — **QUERY the cache, don't open every ticket** (KIT-T026):
   `node <kit>/scripts/q.mjs open <SCOPE>` lists open items (status+priority, sorted), and
   `node <kit>/scripts/q.mjs rundown` gives per-scope open/doing/review counts. q.mjs
   auto-falls-back to a markdown scan when no SQLite engine is present, so it always answers.
   Then:
   - FIRST resume any ticket already `status: doing`.
   - Else pick per `drain`: if `follow_roadmap` and a current milestone exists, take the next
     `todo` in ROADMAP order; otherwise the highest `todo` by type `order` then priority.
   - Skip `review`/`done` and anything `blocked`/gated.
   - NEVER start a ticket that is `superseded` or carries `superseded_by:` (its work is subsumed
     by the replacement) — `q.mjs open` already excludes these, so trust that list (KIT-T024).
   - Arg: none = current milestone then backlog · `all` = ignore milestone gating (pure
     priority) · a milestone name = drain only that milestone.
2. WORK it via the `/work` contract: read the ticket, **restate its acceptance criteria**,
   confirm scope in ONE line (wait for OK only if the plan changes scope or touches files
   outside the ticket), then drive STRUCTURED mutations through the `t` CLI (KIT-T075) — never
   hand-edited frontmatter: `t status <id> doing`, mirror criteria into native tasks, execute,
   `t tick <id> <ordinal|match>` each criterion as it passes. Narrative Notes stay direct-edit.
   - **DISPATCH FIREPOWER (KIT-T034):** when you delegate the ticket to a subagent, resolve its
     model + effort from `config.dispatch` and pass them as the Agent `model`/`effort` — don't
     inherit the parent (Opus-inheritance was the token bleed, KIT-D022). Resolution (first hit
     wins): explicit ticket `model:`/`effort:` (per-axis override) → ticket `tier:` expanded via
     `dispatch.tiers` → `dispatch.default_tier` for the ticket's `type` (else the `*` catch-all).
     A `tier` expands to BOTH model and effort — they are one firepower decision, not two knobs.
   - **PICK THE RIGHT AGENT (KIT-T015):** when delegating, first check for a matching
     project-local knowledge-agent at `<repo>/.claude/agents/<domain>.md`; if one exists, route
     the delegation there instead of a bare general-purpose invocation. It carries the domain's
     conventions, past gotchas, and out-of-scope guard — don't re-explain these in the task
     prompt. If no matching project agent exists, use the closest generic kit agent
     (researcher / refactorer / test-author / code-reviewer) over plain general-purpose.
   - **SUGGEST A KNOWLEDGE-AGENT (KIT-T015):** when a domain (e.g. render layer, physics core,
     verification harness, backport/scope boundary) recurs across multiple delegations and no
     project-local agent exists yet, SURFACE a one-line suggestion after completing the current
     ticket: `suggest: <repo>/.claude/agents/<domain>.md not found — recurring delegations could
     share a knowledge-agent (use /scaffold-agent to create one)`. Don't block; just note it once.
   - **RESEARCH PREFLIGHT (KIT-T047):** before commissioning a researcher or design-doc agent,
     run `node <kit>/scripts/research-preflight.mjs <topic>` (from the adopting repo's root) to
     surface any existing canonical doc; if one is found, instruct the agent to EXTEND it rather
     than author a parallel doc.
3. BOLDNESS per `drain.auto_execute`:
   - `within-patterns-low-risk`: start the item if it follows established patterns and is
     low-risk; otherwise surface ONE line — `next up: <id> — your call: <why>` — and wait.
   - `surface-only`: never start a new item without an explicit go.
4. When an item reaches `review`: summarize the diff, then **pull the next item (step 1) and
   continue** — that is the drain. Never set `done` (maintainer-only).
5. QUESTIONS drain alongside tickets (`drain.answer_self_questions`): scan `.ai/questions/` for
   `status: open`. Answer each `answerable_by: claude` one FROM the code + `.ai/decisions/` (never
   guess — one you can't ground from the record becomes a Chris question), write the answer + date
   into its `**Resolution:**` and set `status: resolved` — RECORD the answer, never delete
   (KIT-T064). Leave `answerable_by: chris` ones open and batch them into the next `/decide`.
6. STOP and report when: the queue is empty, every remaining item needs the maintainer
   (decision / scope / design-gated), or the maintainer says stop. List what's left and why.

**BIG-ASK TRIGGER (KIT-T038):** when an incoming request exceeds a size/risk threshold — long prompt AND a scope/risk signal (redesign, architecture, migrate, from scratch, overhaul, end-to-end, system-wide, etc.) — do NOT one-shot it. Route it into the structured pipeline: draft a plan, write a research doc (`docs/research/`), decompose into tickets, then drain them. Small/routine asks proceed directly; only the big-ask path engages the pipeline. The `UserPromptSubmit` hook nudges this automatically, but the contract here is the authoritative rule.

**STATUS TRANSITIONS ARE MANDATORY (KIT-T028):** a `doing` ticket that gets dropped without a
status flip becomes a zombie that nags every session start. For every ticket you touch:
- Picking it up → `t status <id> doing`.
- Work complete → `t status <id> review` (or `done` when uat=none).
- Bail / blocked / interrupted → `t status <id> todo` before you stop. Never leave doing.

Honor the standing rules throughout: log work to its ticket in the same change (the commit gate
enforces), record decisions the turn they happen, and don't start deferred/gated work.
