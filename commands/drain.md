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
2. WORK the selected ticket via the full `/work` contract — dispatch, scope confirm, `t`
   CLI mutations, Notes/History updates, evidence floor. See `/work` for the complete
   working contract; do not repeat it here.
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

**ONE BLOCKED THREAD ≠ IDLE:** a single item gated on the maintainer (or in review) does NOT
license the whole drain to stall — pull the next workable item from the queue and keep draining
in parallel while that thread waits.

**SUBAGENT FAN-OUT:** fan INDEPENDENT work to parallel agents, coordinate via ticket Notes, and
batch all maintainer decisions into one AskUserQuestion questionnaire rather than surfacing them
piecemeal. When tickets share the checkout or need sequential commits, run them serially; otherwise
fan out. A delegated agent must VERIFY its change by exercising it as the user would — run the
test suite, start the app, or hit the probe — and report empirical evidence. A compile-check alone
is not verification.

Honor the standing rules throughout: log work to its ticket in the same change (the commit gate
enforces), record decisions the turn they happen, and don't start deferred/gated work.
