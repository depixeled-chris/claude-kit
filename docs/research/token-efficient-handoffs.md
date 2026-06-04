# Token-efficient agent handoffs (provenance by reference)

**Question:** How do we make claude-kit's subagent HANDOFFS token-efficient without losing the
provenance grounding KIT-D018 requires? Today the orchestrator inlines whole tickets + guards +
context into every prompt — expensive, and the cost grows with provenance.
**Date:** 2026-06-04 · **Status:** 🔬 ready · proposed ROADMAP **KIT-T021** · informs KIT-T018 / KIT-T019 / KIT-T015

## TL;DR
Grounding stays (KIT-D018); **paste stays out.** Hand each subagent a short handoff that carries
**lightweight identifiers** — a ticket id, governing decision ids, and `path:line` pointers — and
let the agent pull the bytes on demand with the Read/Grep/Glob tools it already has. This is
exactly the "just-in-time retrieval" pattern Anthropic recommends, and it does not weaken
provenance: a pointer to `KIT-D018.md` is *more* authoritative than a paraphrase of it pasted from
the orchestrator's head, because the agent reads the live record (the precise failure KIT-D018
was filed to fix). Move durable, repeating knowledge — the legacy/out-of-scope guard, the
verify-as-the-user-plays rule, the conventions of a recurring domain — out of per-task prompts and
into **reusable agent system prompts** (`agents/*.md` and project-local `.claude/agents/*.md`), so
each handoff shrinks to the *delta*: what's new about this task. Constrain the **return** with a
small structured-result schema so agents report distilled findings + pointers, not full dumps.
Net: a ~1.5–3k-token inlined handoff drops to a ~250–500-token pointer handoff, and the agent
spends a few hundred read-tokens only on what it actually needs.

## Current state
- **Handoff mechanics today.** The orchestrator (the drain/work loop, `commands/drain.md`,
  `commands/work.md`) builds an agent prompt by inlining: the full ticket body (description +
  acceptance criteria + Notes history), the governing decision text, and re-pasted guard prose
  (legacy guard, verify-as-user-plays). KIT-D018 mandates the *grounding*; the current
  *implementation* of that grounding is paste.
- **The agents exist.** `agents/researcher.md`, `code-reviewer.md`, `refactorer.md`,
  `test-author.md` already carry standard frontmatter (`name`/`description`/`tools`) + a system
  prompt body. `agents/researcher.md` already models the discipline this doc wants on the *return*
  side: "**Pointers, not payloads:** cite `path:line` … Don't paste whole files — the caller can
  open the pointer." The handoff side has not yet adopted the same rule.
- **Provenance graph is on disk and addressable.** Tickets (`.ai/tickets/KIT-T0NN-*.md`),
  decisions (`.ai/decisions/KIT-D0NN.md`), research (`docs/`, `research/`), and CODEMAP-style
  indexes are stable files with stable ids. Every one is a valid pointer target; nothing about
  KIT-D018 requires the *bytes* to travel in the prompt — only that the work be *built on* them.
- **What's missing.** (1) A lean, canonical handoff template (KIT-T018 AC explicitly wants one).
  (2) A convention that standing guards live in ONE referenced doc, not re-pasted per handoff.
  (3) A return-result schema. (4) Any way to *measure* handoff token cost or projected savings.

## Design

### Principle: provenance is a graph of pointers, not a payload
KIT-D018's actual requirement is *"every delegation is grounded in the durable record … the
agent builds on prior context (including prior FAILED attempts) instead of rediscovering."* That
requirement is satisfied — arguably *better* satisfied — by handing the agent **addresses** into
the record and a tool to read them, than by pasting a snapshot. Anthropic's context-engineering
guidance is explicit: agents should "maintain lightweight identifiers (file paths, stored queries,
web links, etc.) and use these references to dynamically load data into context at runtime," and
Claude Code itself uses the hybrid where durable knowledge (CLAUDE.md / system prompts) is loaded
up front while `glob`/`grep` fetch the rest just-in-time. Our `.ai` graph is that retrieval
substrate already.

Reconciliation with KIT-D018, stated plainly: **grounding stays; paste goes.** The handoff MUST
still name the ticket, its `links`, the governing decisions, and the relevant docs — that is
non-negotiable provenance. What changes is that it names them by **id + `path:line`** instead of
inlining their text. A delegation that cites *no* ticket is still a KIT-D018 violation (and should
still be lint-flagged per KIT-T018); a delegation that cites the ticket *by reference* is
compliant and cheap.

### The five techniques (each maps to a KIT-T021 phase below)

**1. Provenance by reference — pointers the agent reads on demand.**
Replace inlined ticket/decision/doc text with: the ticket id (the agent reads
`.ai/tickets/<id>*.md`), the decision ids (reads `.ai/decisions/<id>.md`), and **scoped
`path:line` ranges** for the code/doc spans that matter (e.g. `commands/drain.md:8-26`). The agent
has Read/Grep/Glob; it pulls exactly the spans it needs and skips the rest. Crucially this also
fixes a *quality* gap, not just cost: the agent reads the *current* ticket Notes — including a
failed prior attempt appended after the orchestrator last looked — instead of a stale paste.
- *Tradeoff:* one or two extra tool round-trips per agent (a few hundred tokens of reads) vs.
  1–3k tokens of guaranteed paste. Net win whenever the agent would have ignored part of the paste
  — which is almost always. The one case paste wins: a target so small (a 3-line decision) that
  the pointer + read overhead exceeds the inline. For those, inline is fine — see the template's
  "inline only when smaller than the pointer" rule.

**2. Standing guards referenced by name, authored once.**
The legacy/out-of-scope guard and the verify-as-the-user-plays rule are re-pasted into every
handoff today. Author each ONCE as a named doc (e.g. `agents/guards/legacy-guard.md`,
`agents/guards/verify-as-user.md`) and reference it by path in the handoff: *"Honor the standing
guard at `agents/guards/legacy-guard.md`."* Better still, fold the durable guards into the **agent
system prompts** (technique 3) so they're always in the agent's context without any per-task
mention at all.
- *Tradeoff:* a referenced guard the agent forgets to read is a guard not applied. Mitigation: the
  guards that matter most (don't-touch-legacy, verify-as-user) belong *in the system prompt*, which
  is always loaded — not in a referenced file the agent may skip. Use referenced-by-name only for
  longer, situational guards.

**3. Reusable agent system prompts carry the durable knowledge; per-task prompts carry the delta.**
This is the highest-leverage lever. Anthropic: put durable knowledge at the right "altitude" in the
**system prompt** and start prompts minimal. A subagent runs in its **own isolated context window**,
so anything in its `agents/*.md` body is loaded *once* for that agent and never re-paid per task.
- Generic roles stay in claude-kit's `agents/` (researcher/reviewer/refactorer/test-author) — the
  durable "how a researcher works / returns pointers not payloads" already lives there.
- Recurring *project* domains get project-local `.claude/agents/<domain>.md` carrying that domain's
  conventions + known gotchas + its guard section — exactly the KIT-T015 pattern (HOD's
  hod-render / hod-sim-core / hod-verify exemplars). The orchestrator ROUTES to the matching
  project agent (KIT-T015 AC) instead of re-explaining the domain in every prompt.
- The per-task handoff then shrinks to: *which ticket, what's new, where to look, how to report.*
- *Tradeoff:* system prompts drift from reality if not maintained — but the agent README already
  mandates "iterate in place," and a stale `agents/*.md` is one fix that propagates to every
  delegation, vs. a stale paste that's re-authored (and re-broken) each time. Strongly favorable.

**4. Structured return schema to cut return-token waste.**
Constrain the agent's *output* to a small fixed shape: `result` (1–3 sentences), `evidence`
(`path:line` pointers + the decisive quoted lines only), `verified` vs `inferred`, `gaps`, and
`writes` (any `.ai/inbox`|`questions`|`notes` files it created per KIT-T019). This kills preamble
("Here is the output you requested…") and full-file regurgitation, and it makes results
machine-checkable for the bubble-up surfacing in KIT-T019. Anthropic's multi-agent system treats
subagents as *compression*: explore in tens of thousands of tokens, return a distilled
**1,000–2,000-token** summary. The schema enforces that compression.
- *Tradeoff:* an over-rigid schema can truncate a genuinely important nuance. Keep a free-text
  `notes` field for the irreducible remainder; the schema shapes, it doesn't gag.

**5. Summary-vs-full context — choose per dependency, default to reference.**
Three tiers, cheapest first: (a) **pointer** (id + `path:line`) — the default; (b) **summary**
(the ticket's TL;DR / the decision's one-line `title:` frontmatter, inlined) — when the agent needs
orientation *before* it knows whether to open the file; (c) **full inline** — only for a target
smaller than its own pointer, or a span the agent provably must have verbatim (e.g. an exact error
string to match). Anthropic's compaction guidance applies to the *orchestrator's own* long context
(KIT-D017's "one long-lived orchestrator, many short agent contexts"): compact the loop when it
nears limits; for handoffs, prefer retrieval over carrying summaries.
- *Tradeoff:* summaries can be stale or lossy (the compaction precision/recall problem). Use them
  for orientation only; the agent still reads the authoritative file before acting.

### Alternatives weighed
- **Keep inlining everything (status quo).** Simplest, zero new moving parts; KIT-D018-compliant.
  Rejected: cost scales with provenance depth exactly where the maintainer flagged pain, and
  pasted text goes stale relative to the live ticket (the KIT-D018 failure mode in miniature).
- **Pure RAG / embeddings retrieval of provenance.** Overkill. The `.ai` graph is small, has
  stable human-readable ids, and the agent has Grep/Glob — semantic retrieval adds a dependency and
  a failure mode (wrong chunk) for a corpus that's trivially addressable by id. KIT already chose
  dep-free heuristics + an optional accuracy layer for the code graph; same logic applies.
- **Drop provenance to save tokens.** Off the table — direct KIT-D018 violation; this whole doc
  exists to *avoid* that trade.

## Phased plan
Each phase is gated by a concrete, checkable artifact (this is a docs/contract repo, so the "test"
is a contract assertion + a measured token delta on a real handoff, not a unit test).

**Phase 1 — Lean handoff template + the reference rule.**
Add the canonical template (below) to the drain/work contract; state the "reference, don't paste;
inline only when smaller than the pointer" rule.
*Gate:* re-author one real recent delegation (e.g. the "fix textures" case from KIT-T018) in the
new template; measure with `scripts/handoff-tokens.mjs` (Phase 5) that it cites the same ticket +
decisions by id and lands ≥60% smaller than the inlined version. KIT-T018's "delegation citing no
ticket is flagged" lint still passes against the template.

**Phase 2 — Standing guards authored once + referenced.**
Extract the legacy/out-of-scope guard and verify-as-user rule into named docs; put the two
load-bearing ones into the relevant agent system prompts.
*Gate:* `grep -r` finds the guard prose in exactly ONE place each; the handoff template references
it by path; a delegation built from the template applies the guard with no per-task guard paste.

**Phase 3 — Push durable knowledge into agent system prompts (KIT-T015 tie-in).**
Audit `agents/*.md`: move repeating per-task instructions into the role's system prompt. Document
the project-local `.claude/agents/<domain>.md` convention and the orchestrator's routing rule.
*Gate:* a handoff to a domain agent carries zero domain-convention prose (it's in the agent body);
the per-task prompt is only ticket id + delta + pointers + report-shape. Diff a before/after
handoff to show the delta-only shrink.

**Phase 4 — Structured return schema.**
Define the result schema (result / evidence-pointers / verified-vs-inferred / gaps / writes) in
the agent README and each agent body; align with KIT-T019's bubble-up writes.
*Gate:* an agent run returns the schema; the orchestrator can parse `writes` and surface new
`questions/`|`inbox/` items (KIT-T019 AC) without re-reading the agent's prose.

**Phase 5 — Measurement harness.**
Ship `scripts/handoff-tokens.mjs`: given a handoff (and the files it would have inlined), report
estimated tokens for the inline-everything baseline vs. the pointer handoff, plus an estimate of
on-demand read cost. Use a tokenizer if available, else the ~4-chars/token heuristic (mark it
version-fragile).
*Gate:* the script runs on Phases 1/3 sample handoffs and prints a baseline-vs-reference delta;
the numbers back the savings claims in this doc instead of asserting them.

## Performance (token economics)
- **Where tokens go today (per handoff, estimated, 4-chars/token rule).** Full ticket body
  ~400–900 tok; governing decision text ~250–450 tok each (often 2–3 cited → ~750–1,350); re-pasted
  guards ~300–600 tok; orchestrator framing ~150–300. Typical inlined handoff ≈ **1,500–3,000
  tokens**, and it grows linearly with the number of linked decisions/docs — the exact "grows with
  provenance" cost the ticket names.
- **Pointer handoff.** Ticket id + 2–3 decision ids + 3–5 `path:line` pointers + report-shape ≈
  **250–500 tokens**, *flat* in provenance depth (more provenance = more ids, ~10 tok each, not
  more pasted bodies). The agent then spends on-demand reads only on spans it opens — and because
  it reads ranges, often *less* than the full inline would have cost. Net per-handoff saving ≈
  **60–85%**, larger the deeper the provenance graph.
- **System-prompt amortization.** Durable knowledge in `agents/*.md` is loaded once into the
  subagent's isolated window and never re-paid per task — so a guard/convention that cost N tokens
  in *every* handoff now costs N tokens *once per agent context*. With many short agent contexts
  (KIT-D017), this is where the structural saving compounds.
- **Return side.** The structured schema targets the Anthropic 1–2k-token distilled-summary band
  instead of full-file dumps; the bigger orchestrator win is that a clean orchestrator context
  (KIT-D017) absorbing 250-token receipts instead of 3k-token pastes stays `/clear`-cheap and
  rebuildable longer.
- **Caveat — measure, don't trust the model.** These are 4-chars/token estimates; the real number
  depends on the tokenizer and the actual files. Phase 5's harness is what turns these into facts.
  Standing performance-vigilance rule: report the measured delta when the template ships.

## Open-core classification
claude-kit is **public + MIT** (per `research/README.md` / `agents/README.md`: "Non-proprietary
only"). This work — handoff templates, the reference-not-paste convention, generic agent system
prompts, a structured return schema, a token-measurement script — is **generic orchestration
mechanics with no product domain**, so it is **public-living**: it belongs in claude-kit and ships
to every adopting project.
- **Stays public:** the template, the guard docs, the generic `agents/*.md` bodies, the schema,
  `scripts/handoff-tokens.mjs`.
- **Stays in the consuming project (NOT claude-kit):** any *project-specific* agent
  (`.claude/agents/<domain>.md`) and the concrete guard *content* tied to a private codebase — per
  KIT-T015 and the agent README rule that domain/commercial agents live in the project, not the kit.
  HOD's hod-render/hod-sim-core/hod-verify are the exemplars: the *pattern* is public here, the
  *instances* are private there.
- **Gray area for the maintainer:** this doc was written under `docs/research/` because the ticket
  said `docs/`, but claude-kit already has a cross-project `research/` knowledgebase (with its own
  index + "non-proprietary only" rule) seeded empty. This topic is exactly that knowledgebase's
  charter (generic agent-orchestration mechanics). **Recommend** either (a) move/symlink this into
  `research/token-efficient-handoffs.md` and list it in that index, or (b) keep project-flavored
  notes in `docs/research/` and extract the generic core into `research/` per its stated rule.
  Flagging rather than deciding, since it's an index/placement call.

## Sources
- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — just-in-time retrieval via lightweight identifiers; the CLAUDE.md + glob/grep hybrid; system-prompt "altitude"; sub-agents return ~1,000–2,000-token distilled summaries; "smallest set of high-signal tokens"; structured note-taking; compaction recall/precision.
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — token usage explains ~80% of performance variance; multi-agent ≈15× chat tokens (agents ≈4×); subagents as "compression"; "each subagent needs an objective, an output format, guidance on tools/sources, and clear task boundaries"; effort scaled to query complexity.
- [Claude Code — Best practices](https://code.claude.com/docs/en/best-practices) — subagents run in separate context windows with their own tools; delegate investigation to keep the main context clean.
- [Claude API — Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) — context-window mechanics underlying the per-context amortization argument.
- [Anthropic — Building agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk) — subagent definitions carry durable system prompts in isolated context; filesystem-as-context; verification loops.
- [Claude Cookbook — Context engineering: memory, compaction, and tool clearing](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools) — compaction and tool-result clearing for long-running orchestrator contexts.
- [Cohere — How do Structured Outputs work?](https://docs.cohere.com/docs/structured-outputs) and [Tetrate — LLM output parsing & structured generation](https://tetrate.io/learn/ai/llm-output-parsing-structured-generation) — constrained decoding drops preamble/dead-end tokens and guarantees a parseable result shape (the return-schema lever).

---

### Appendix — recommended lean handoff template
```
## Handoff: <one-line task>  (ticket: KIT-T0NN)
PROVENANCE (read before acting — do not work from this prompt alone):
  - Ticket:    .ai/tickets/KIT-T0NN-*.md   (acceptance criteria + Notes history, incl. prior attempts)
  - Decisions: KIT-D0NN, KIT-D0MM          (.ai/decisions/<id>.md)
  - Docs:      docs/research/<topic>.md, docs/CODEMAP.md#<anchor>
  - Code:      <path>:<startLine>-<endLine>  (the spans that matter; open more via Grep/Glob as needed)
GUARDS (standing — always apply): you are the <role> agent; honor your system prompt.
  Situational: agents/guards/legacy-guard.md, agents/guards/verify-as-user.md
DELTA (what's new about THIS task, the only thing not already on disk):
  <2–4 lines: the specific change/question, constraints, and definition of done>
REPORT (structured result):
  result:   1–3 sentences — the answer / what you did
  evidence: path:line pointers + only the decisive quoted lines (no full files)
  verified / inferred: separate what you proved from what you assume
  gaps:     unknowns, blockers, anything you couldn't confirm (+ where you looked)
  writes:   any .ai/inbox|questions|notes files you created, with ticket back-links (KIT-T019)
RULE: reference, don't paste. Inline a target ONLY if it's smaller than its own pointer.
```
