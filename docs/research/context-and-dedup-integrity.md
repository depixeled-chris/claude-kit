# Context + dedup integrity — one coherent design (KIT-T023 / T024 / T025)

**Question:** How do we make the durable record ACTIVELY surface the right context at decision
points (KIT-T023) AND keep every store free of accreting duplicates (KIT-T024 tickets, KIT-T025
cross-store) — as ONE design, not three fragmented ones?
**Date:** 2026-06-05 · **Status:** 🔬 ready (design — maintainer review pending) · proposed ROADMAP **KIT-T033**

## TL;DR

These three tickets are one system: **the record only stays trustworthy as active context if it
also stays deduplicated, and dedup only stays safe if the record actively surfaces what already
exists before you create more.** The unifying frame is the cross-scope SQLite cache (KIT-T004,
derived/one-way/fail-open, FTS5 over every store, a `links` edge table) as the *retrieval
substrate*, and the SessionStart `orient` hook (`hooks/orient.mjs`) as the *active-surfacing
lever*. One detection method already exists — `q.mjs similar`, an FTS OR-of-terms query confined
per store — so the remaining work is not "build a detector" but "run it at the three moments that
matter (capture / triage / sweep) and resolve by store policy." The resolution policy is settled
and reconciles cleanly with the decisions: **AUTO-resolve only unambiguous TICKET duplicates**
(drain-affecting, costly; KIT-D021 automate-over-manual via the already-built
`reconcile-supersede.mjs`); **SUGGEST-ONLY for decisions/notes/questions**, because a "duplicate"
there is usually deliberate nuance (KIT-D018 refining KIT-D017 is not a dup — auto-superseding it
would destroy the very provenance trail KIT-D018 exists to protect; and the memory-hygiene rule
forbids silent prune). KIT-T024's mechanic is **done**; KIT-T025's cross-store detector is **done**;
the open work is (1) the *active surfacing* of KIT-T023 and (2) the *automated sweep* with its
per-store resolution wired in. Both extend existing seams; neither needs new infrastructure.

## Current state — what exists today vs what's missing

### Landed (do not rebuild)

- **The cache** is the substrate for all three. `scripts/hydrate-db.mjs` builds a derived,
  gitignored, one-way SQLite DB unioning every registered scope (cross-scope, KIT-T031;
  `hydrate-db.mjs:134-150`). Schema (`hydrate-db.mjs:45-106`): an `items` table with
  `scope/store/status/...`, a `links(from_id, rel, to_id)` edge table indexed both directions,
  and a **standalone FTS5** `items_fts(id UNINDEXED, title, body)` chosen specifically so
  `snippet()` and column reads work for agent retrieval (`hydrate-db.mjs:100-103`). It is
  hydrated lazily on the `Stop` hook (`hooks/hydrate-cache.mjs`), fail-open: no SQLite engine, a
  parse error, anything — it skips and queries fall back to a markdown scan.
- **The detector** is one method, already cross-store. `q.mjs similar [--store <s>] <text>` turns
  a proposed title/labels into an FTS OR-of-barewords query (a dup rarely shares *every* word) and
  returns same-store candidates, excluding `superseded`/archived, **suggest-only**
  (`scripts/q.mjs:46-63, 197-210`). The markdown-scan fallback mirrors it with a term-overlap
  ranker at parity (`scripts/q.mjs:318-337`). `parseSimilar` splits the `--store` filter in ONE
  place so cache and scan agree (`scripts/q.mjs:60-63`); default store is `tickets` so KIT-T024
  callers are unchanged.
- **Ticket resolution** is fully built (KIT-T024, status `review`). Frontmatter
  `supersedes:`/`superseded_by:` parse into `supersedes`/`superseded_by` link edges
  (`hydrate-db.mjs:212-215`); a single `isSuperseded` predicate drops a retired ticket from the
  active/drain set in both the cache SQL and the scan (`scripts/q.mjs:117, 138-144, 262`);
  `index-tickets` renders a `## Superseded` board + `.ai/SUPERSEDED.md` chain. The resolution is
  **automatic + idempotent** per KIT-D021: `scripts/reconcile-supersede.mjs`, invoked at the top
  of `index-tickets`, writes the reciprocal pointer and flips the retired ticket to
  `status: superseded` from a one-sided declaration on EITHER side — only ever flips TO superseded,
  never un-flips, never touches the live replacement (`reconcile-supersede.mjs:1-19, 89-117`).
- **Surfacing the hint at creation** is wired: `triage.md` step 3 calls `similar --store`, and
  `next-id.mjs … -- <title>` auto-runs it on stderr (never blocks; id always prints).
- **Orient already surfaces some active context.** `hooks/orient.mjs` is SessionStart-only
  (KIT-D020 — does NOT fire for subagents) and already queries the cache for **Open work** grouped
  by scope, calling out THIS scope's in-flight `doing`/`review` (`orient.mjs:118-143`), plus recent
  commits, SESSION.md, ROADMAP, recent decisions, lineage, and the IDENTITY block. This is the
  lever KIT-T023 builds on — it proves orient can *push* cache-derived facts, not just dump files.

### Missing

1. **KIT-T023 active surfacing.** Orient surfaces *what is open*, but not *what already exists
   that is relevant to what I am about to do*. The root failure (2026-06-04): the record HELD the
   answer (`rust-world-architecture`: TS sim is legacy, Rust/WASM is the product) and the work
   still proceeded against the legacy path — because the governing record was a passive index entry,
   not pushed in front of the actor at the decision/handoff. There is **no topical surfacing** (on
   touching a file/area, inject the governing decisions/memories), **no derived runtime-reality**
   in orient (which sim `npm run dev` actually runs — fact, not memory), and **no by-construction
   provenance into handoffs** beyond the human-authored prompt.
2. **The automated cross-store sweep** (KIT-T025 AC). The detector exists; nothing runs it
   periodically across all stores, and the **per-store resolution policy is decided but not coded**.
3. **A non-ticket resolution path that preserves the trail.** Decisions have `supersedes:`; notes
   and questions have nothing structured, and the memory-hygiene guarantee (never silently prune)
   needs to be an enforced property of whatever the sweep does, not a hope.

## Design

### The single frame: detect → surface → resolve, over the cache, by store policy

The three tickets are three faces of one loop, all riding the cache + FTS substrate:

- **KIT-T025 = detect** (one FTS method, per-store thresholds, three run-points).
- **KIT-T023 = surface** (turn the passive record active via orient + topical injection +
  derived runtime-reality + by-construction handoff provenance).
- **KIT-T024 = resolve** (supersede/link/auto-reconcile — *built for tickets*; the policy below
  extends the *resolution* concept to other stores without forcing the ticket mechanic onto them).

#### 1. Detection — one method, per-store thresholds, three run-points

Keep the single `q.mjs similar` method (DRY — KIT-T024/T025 already refused to fork a second
similarity impl). What varies is **threshold** and **run-point**, not algorithm.

- **Method (unchanged):** FTS OR-of-barewords over `items_fts`, store-confined, exclude
  `superseded`/archived, suggest-ranked by FTS `rank` (cache) / term-overlap (scan). No
  embeddings: the `.ai` graph is small, ids are stable and human-readable, and the kit already
  chose dep-free heuristics with an optional accuracy layer (same logic as the code-graph). An
  embeddings tier is a *later* option, not v1.
- **Per-store threshold** (the new, codified part — a small config table, not scattered
  conditionals, honoring "one source of truth for types"):
  - *tickets* — **AUTO-eligible only on the unambiguous case**: identical normalized title (lowercase,
    strip punctuation/stopwords) AND ≥N shared significant terms. Everything below that is
    suggest-only.
  - *decisions / notes / questions* — **always suggest-only**, no auto threshold (rationale below).
- **Three run-points:**
  - **Capture** — already live (next-id/triage hint). Suggest-only, fail-open, id always prints.
  - **Triage** — already live (`triage.md` step 3). The operator/agent links/supersedes by hand.
  - **Sweep** — *new*: an automated pass over all stores (KIT-T025 AC). Runs where the board is
    already rebuilt — **inside `index-tickets`, immediately after `reconcile-supersede`** — so it is
    deterministic, idempotent, and out of the PreToolUse/commit hot path (the exact placement
    KIT-D021 + KIT-T024 chose for reconcile). It NEVER runs on a write hook.

#### 2. Resolution per store + the memory-hygiene guarantee

This is where the just-locked policy lands, reconciled with KIT-D018/D021 and memory hygiene:

- **Tickets → AUTO (unambiguous only).** A dup ticket is *costly* — it leaks into the drain and a
  subagent may work it twice (the exact harm KIT-T024 names). On the unambiguous threshold the
  sweep WRITES a `supersedes` edge on the newer ticket; the existing `reconcile-supersede` pass
  then writes the reciprocal and flips status. Nothing new is built — the sweep just *feeds*
  KIT-T024's proven, idempotent reconcile. Below threshold → suggest-only on the board.
- **Decisions / notes / questions → SUGGEST-ONLY, always.** A near-duplicate *decision* is
  usually deliberate evolution, not waste: **KIT-D018 refining KIT-D017** would score as a dup,
  but auto-superseding it would erase the refinement trail — destroying the provenance KIT-D018
  exists to protect. Decisions already model evolution explicitly via `supersedes:` + `links:`;
  the human/agent declares that intent, the tooling never guesses it. Notes/questions carry
  irreducible nuance for the same reason. So for these stores the sweep only **surfaces candidate
  clusters** (in the board / a generated `DUPES.md`) for an operator/agent to link, supersede, or
  dismiss. This is option **(C)** from KIT-T025's open fork — auto for tickets, suggest for the
  rest — and it is the one consistent with both KIT-D021 (automate the *unambiguous* reconcile)
  and KIT-D018 (never let automation eat provenance).
- **Memory-hygiene guarantee (hard invariant): never silently prune.** Resolution is
  **supersede/link**, never delete. A superseded ticket keeps its file, its history, and a
  `superseded_by` pointer to its replacement; it leaves the *active* set but stays on the
  `## Superseded` board and in `.ai/SUPERSEDED.md`. The content trail is always reachable. The
  sweep's suggest-only output for non-ticket stores is presented, never auto-applied — the global
  rule "Never silently prune memory or log entries — present them; the user decides" is satisfied
  by construction. A test asserts no store file is ever deleted or content-stripped by the sweep.

#### 3. Active surfacing (KIT-T023) — passive record → pushed context

Three mechanisms, cheapest/most-certain first, all leveraging that orient already pushes
cache-derived facts main-thread-only:

- **(a) Derived runtime-reality in orient (highest certainty, cheapest).** Orient DERIVES and
  states the actual runtime config from the code/env — not from memory. For HOD: which sim
  `npm run dev` runs (read the Vite config / `VITE_SIM` / build flags), so "what the user sees" is
  a *fact* in the briefing, never assumed. This is the direct antidote to the root failure (work
  proceeded against the legacy sim because nobody checked which sim actually runs). Generic
  mechanism (read declared run/build config), project-specific *facts* (the actual flags) — the
  generic part ships in the kit, the specifics are read from the consuming repo at runtime.
- **(b) Topical active surfacing — governing record keyed to what you touch.** When work touches a
  file/area, surface the governing decisions/notes/memories for it, instead of leaving them buried
  in an index. Two reuse-only levers, no new index:
  - The cache already records `files:` per item and `links`/wikilink edges. A `q.mjs governing
    <path-or-id>` query returns the decisions/notes whose `files:` overlap the touched path, or
    that the touched ticket `links:` — i.e. *traverse the edges that already exist* (KIT-T023's
    "cross-links operative"). Surfaced in orient's resume view for the in-flight ticket's files,
    and available to the handoff builder.
  - A `pre-write` *advisory* (NOT a block, fail-open) can echo the governing record for the path
    being edited — the same fail-open posture as the existing pre-write checks. Advisory only:
    a missed surface must never wedge a write.
- **(c) Provenance into handoffs by construction (closes the KIT-D018 loop, ties to KIT-T020).**
  The handoff builder pulls the ticket's `links` + governing decisions/docs from the cache and
  emits them as **pointers** (id + `file:line`) in the brief — so the agent builds on the record
  by construction, not on the human-authored prompt that *inverted it* in the root failure. This
  is exactly KIT-T020's provenance-by-reference template fed from the cache; KIT-T023 makes it
  *automatic* rather than relying on the prompt author's recollection.

Why orient is the lever and not memory/CLAUDE.md/`/prime`: KIT-D020 settled that the
orchestrator's operating context is instantiated by the **SessionStart orient hook** — it fires on
every new session and after `/clear`/`/compact`, is main-thread-only (no subagent bloat), and is
already the home of the IDENTITY block and the cache-queried Open-work view. Active surfacing is
the same seam doing more of its existing job.

### Alternatives weighed

- **Embeddings / semantic dedup now.** Rejected for v1: the corpus is small and id-addressable;
  embeddings add a dependency and a false-merge failure mode for marginal recall gain. Reserve as
  a later accuracy tier behind the same `similar` interface (mirrors the code-graph's optional
  tree-sitter layer).
- **Auto-supersede across ALL stores (KIT-T025 fork option B).** Rejected: a false positive
  auto-merging two *decisions* silently destroys a deliberate refinement trail — a direct
  KIT-D018 + memory-hygiene violation. Auto is confined to the one store where a dup is pure cost
  and the unambiguous test is safe (tickets).
- **Suggest-only everywhere, including tickets (fork option A).** Rejected per KIT-D021: it relies
  on a remembered manual follow-up — the exact reliability gap the automate-over-manual decision
  rejects — for the one store where dups are most expensive.
- **A second topical index for surfacing.** Rejected (DRY): the cache already holds `files:`,
  `links`, wikilinks, and FTS. Surfacing is a *query* over existing edges, not a new store.
- **Put active-surfacing rules in memory/CLAUDE.md.** Rejected per KIT-D020: wrong layer (memory
  is flaky; CLAUDE.md bloats every subagent). The orient hook is the structural home.

## Phased plan (test-gated; this is a tooling repo, so each gate is an automated assertion in
`scripts/db-cache.test.mjs` or a sibling test, plus a contract assertion where the artifact is a doc/command)

**Phase 0 — Land KIT-T024 (already at `review`).** No new code; maintainer moves it to `done`.
*Gate (already passing):* `db-cache.test.mjs` supersede/reconcile cases — one-sided `supersedes`
auto-writes the reciprocal + flips status; idempotent re-run rewrites no bytes; retired ticket
excluded from `q.mjs open`. Full `npm test` green.

**Phase 1 — Per-store threshold table + sweep (KIT-T025 AC, the automated sweep).**
Add the small per-store threshold config (auto-eligible: tickets only, on identical-normalized-title
+ ≥N shared terms; all others suggest-only) as ONE table. Add a `sweep` step inside `index-tickets`
*after* `reconcile-supersede`: for tickets it writes a `supersedes` edge on an unambiguous dup (then
reconcile flips it); for every store it emits a generated `.ai/DUPES.md` cluster report (suggest-only).
*Gate:* a test where two tickets with identical normalized titles + N shared terms get auto-linked
(newer→older `supersedes`, old flipped, dropped from `open`); two *similar-but-not-identical* tickets
are NOT auto-linked (only reported); two near-duplicate *decisions* (e.g. a KIT-D017/D018-shaped pair)
are reported in `DUPES.md` but NEVER auto-edited; **a test asserts the sweep deletes/strips no file**
(memory-hygiene invariant). Idempotent second run rewrites nothing.

**Phase 2 — Active surfacing: derived runtime-reality in orient (KIT-T023 mechanism a).**
Orient derives + prints the actual run/build config from the consuming repo (generic reader; HOD's
sim flag as the first concrete fact). Fail-open: unreadable config → the section is omitted, never an
error.
*Gate:* a hermetic test gives orient a temp repo whose run-config declares sim X; orient's output
contains the derived "runtime: sim X" line; a repo with no such config produces orient output with
the section absent and no throw.

**Phase 3 — Topical surfacing query + orient/pre-write wiring (KIT-T023 mechanism b).**
Add `q.mjs governing <path-or-id>` (decisions/notes whose `files:` overlap the path, or that the
item `links:`; traversed over existing edges, with a markdown-scan fallback at parity). Surface it in
orient for the in-flight ticket's files; add the fail-open pre-write *advisory*.
*Gate:* a test seeds a decision with `files: [src/sim/foo.ts]` and asserts `governing src/sim/foo.ts`
returns it (cache AND `--no-db` scan, at parity); orient for an in-flight ticket touching that file
includes the governing decision; the pre-write advisory echoes it and **does not block** (exit 0).

**Phase 4 — By-construction handoff provenance (KIT-T023 mechanism c; depends on KIT-T020 template).**
The handoff builder pulls the active ticket's `links` + governing decisions/docs from the cache and
emits them as pointers in the KIT-T020 lean template — automatic, not prompt-author-dependent.
*Gate:* a contract test: given a ticket id, the generated handoff cites that ticket + its linked
decision ids by `file:line`, with zero pasted bodies; an assertion that a handoff citing no ticket is
still flagged (KIT-T018 lint unbroken).

## Performance

claude-kit is a tooling/contract repo; the relevant "performance" is **token economy + session
latency**, not frame budget.

- **Detection/sweep cost:** FTS5 over the small `.ai` corpus is sub-millisecond per query; the
  sweep runs inside `index-tickets` (already an O(all-tickets) pass that reads + writes the board),
  so it adds one FTS query per new item, not a new full scan. It is on the `Stop`/board-rebuild
  path, never PreToolUse/commit — zero hot-path cost.
- **Active surfacing token cost:** orient is **main-thread-only** (KIT-D020), so derived
  runtime-reality + topical surfacing are paid **once per session**, never per subagent — the right
  altitude. Each addition is a few capped lines (runtime config line; the governing items for the
  in-flight ticket's files), consistent with orient's existing 12-commit / 40-SESSION / 50-ROADMAP
  caps. The handoff provenance (Phase 4) is pointers (id + `file:line`), which *reduce* handoff
  tokens vs. pasting (KIT-T020 measured ~60-85% smaller). Net: active surfacing trades a small,
  once-per-session orient cost for avoiding the far larger cost of an agent rediscovering — or
  proceeding against — the wrong context.
- **Fail-open everywhere:** no SQLite engine → markdown-scan fallback (slower but bounded; corpus
  is small). A cache hiccup never blocks orientation or a write — the existing posture, preserved.
- **Cross-platform:** all Node, no OS shell strings; the cache path honors `$CLAUDE_PLUGIN_ROOT`.
  No WASM relevance (this is the workflow kit, not the game engine).

## Open-core classification

claude-kit is **public + MIT** (`research/README.md`: "Non-proprietary only"). Classifying against
that boundary:

- **Public-living (ships in the kit):** the entire dedup mechanism + policy (the `similar`
  detector, the per-store threshold table, the sweep, `reconcile-supersede`, the memory-hygiene
  invariant), and the *generic* active-surfacing machinery (orient's runtime-reality *reader*, the
  `governing` query, the fail-open pre-write advisory, the handoff-provenance builder). These are
  generic workflow-integrity mechanics with no product domain — they belong to every adopting
  project.
- **Stays in the consuming project (NOT the kit):** the *concrete facts* surfaced — e.g. HOD's
  specific sim flag, HOD's `files:`-keyed decisions/memories, any project-private dedup *content*.
  The kit ships the *reader/query*; the *data* is read from the private repo at runtime. (Same
  split as the project-knowledge-agent pattern: pattern public, instances private.)
- **Gray area to raise with the maintainer (placement):** this doc was written under
  `docs/research/` (per the task), but claude-kit maintains a **second** research home —
  `research/README.md`, the cross-project, "non-proprietary only" knowledgebase whose index is
  still empty and whose charter is exactly this kind of generic mechanics. The prior
  `token-efficient-handoffs.md` flagged the same duplication. **Recommend** the maintainer pick one
  home: either (a) move generic kit-mechanics docs into `research/` and list them in that index, or
  (b) keep `docs/research/` as the kit's own design docs and reserve `research/` for cross-project
  algorithm/benchmark findings. Flagging rather than deciding — it is an index/placement call, and
  ironically a "two stores accreting the same thing" instance of the very problem this doc designs
  against.

## Sources

This design is grounded in the repo's landed code + decisions (cited inline by `file:line`); the
two external context-engineering references that the surfacing/handoff rationale rests on:

- [Anthropic — Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — just-in-time retrieval via lightweight identifiers (ids + `file:line`) loaded at runtime rather than pre-pasted; durable knowledge at the right "altitude" (the orient-hook, main-thread-only argument).
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — subagents need an explicit objective + grounding + clear boundaries; provenance-by-construction over prompt-author recollection (the KIT-D018 / handoff rationale).

Primary in-repo sources (verified): `scripts/q.mjs` (detector + `parseSimilar` + `isSuperseded`),
`scripts/hydrate-db.mjs` (cache schema, FTS5, cross-scope union, supersede edges),
`scripts/reconcile-supersede.mjs` (automatic idempotent ticket resolution),
`hooks/orient.mjs` (SessionStart active surfacing + cache-queried Open work),
`hooks/hydrate-cache.mjs` (fail-open Stop-hook hydration), `commands/triage.md` (capture/triage
dedup wiring), and decisions KIT-D017 / KIT-D018 / KIT-D020 / KIT-D021.
