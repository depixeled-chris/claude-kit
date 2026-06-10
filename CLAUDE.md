# Project

<!--
  Paste this block into the project's CLAUDE.md (init-project.mjs appends it
  automatically). It is the behavioral contract. It deliberately does NOT
  contain the taxonomy — that lives in .ai/config.yml so it stays flexible.
-->

## Workflow contract (.ai/)

The taxonomy, routing, priorities, statuses, and drain rules are defined in
`.ai/config.yml`. **Read it at session start; it is the source of truth.** This
contract is the meta-behavior around it.

### Interjections — default is CAPTURE, not STEER
When Chris says something while I am working, the default is: **route it to the
right place and keep working.** Blocking is the exception, not the rule.

For each interjection I:
1. **Classify** it against `.ai/config.yml` → `classifications`.
2. **Route** it to that type's `routes_to` destination, creating/appending the
   artifact (ticket, question, note, decision, or the active ticket).
3. **Receipt**: per `config.receipts`, emit one line so a misroute is caught in
   three words — e.g. `→ BUG-024 logged (high), still on KIT-T001`.
4. **Continue** the current task.

**Block only when** the classification's `blocking` rule fires:
- `always` (e.g. scope-change on the active ticket),
- `when-touching-active` and the input concerns the file/area I am editing now,
- `when-caused-by-active` and it is a regression from my current change,
- or Chris explicitly says stop / "this matters now".

Chris overrides either way at any time: "just log it" forces deferral; "stop"
forces a block. If classification is ambiguous, pick the best fit, state it in
the receipt, and continue — do not halt to ask.

### Draining the queue (so "later" happens without being asked)
- **Between tickets**: when the active ticket hits `review`, pull the next item
  per `config.drain` (roadmap order if a current milestone exists, else type
  `order` + priority). If `auto_execute: within-patterns-low-risk` and the item
  is low-risk and pattern-following, start it; otherwise surface one line:
  `next up: T-007 (your call — touches UX)`.
- **Questions**: answer the ones resolvable from code or `.ai/DECISIONS.md`
  immediately and log the answer; batch genuinely Chris-only questions for a
  natural break rather than interrupting.
- **Regressions**: priority-bumped per config; surface proactively.
- **Anti-relitigation**: if an interjection reopens a point already in
  `.ai/DECISIONS.md`, cite it in one line ("settled 2026-05-30: X because Y —
  still holds?") instead of re-debating. Settled stays settled.

### Working a ticket
On "work KIT-T001" (or when I pull it from the drain):
1. Read `.ai/tickets/KIT-T001*.md`; **restate the acceptance criteria**.
2. **Confirm scope before editing files** (Chris's standing rule). Within an
   already-approved ticket, proceed through the plan without re-asking per file.
3. Set `status: doing`. Mirror each acceptance criterion into the native task
   list (TaskCreate, with blockedBy for ordering) for live progress in the UI —
   native tasks are throwaway; **the ticket file is truth.**
4. As each criterion is satisfied, check its box `[x]` in the ticket and append
   to `## Notes` (a log — never delete prior notes).
5. When all criteria pass WITH test evidence, consult `config.uat` (KIT-D034):
   - `none` (THIS repo — per-ticket `uat:` frontmatter overrides): set `status: done`
     directly, move the file to `tickets/archive/`, regenerate the index, summarize.
   - `required`: set `status: review`, stop, summarize the diff for Chris.
6. **Never set a `statuses.human_only` status myself** (this repo's list is empty —
   acceptance is delegated per KIT-D034; the template keeps `done` human-only).

### Backlog vs roadmap
- **Backlog** = tickets with `status: todo` and no `milestone`. Everything
  captured lands here first.
- **Roadmap** (`.ai/ROADMAP.md`) = sequenced milestones. Scheduling a ticket
  means giving it a `milestone`. When a current milestone exists, the drain
  works it in order before pulling loose backlog.

### Session memory (anti-amnesia)
- `.ai/SESSION.md` is working memory. After any meaningful step, update its
  current state + next 3 steps. Keep it to one screen — overwrite stale content.
- Record exact commands, error text, paths, and version pins **verbatim** in
  SESSION.md. Never trust these to survive in chat (compaction paraphrases).
- Append design choices to `.ai/DECISIONS.md` (decided / rejected / why).
- **Before any /compact or /clear, flush SESSION.md first.**
- Prefer subagents for codebase search; pass pointers (path + line range), not
  whole-file dumps, to keep the main thread lean.
