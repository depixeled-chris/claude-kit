---
description: Batch pending decisions into an AskUserQuestion questionnaire and record each answer to the decisions store
argument-hint: "[doc-path | questions | all]  (optional; default: research docs + .ai/questions)"
---
Resolve the maintainer's PENDING decisions as a structured questionnaire — never as prose
(KIT-T005). No-op if the repo has no `.ai/`.

1. **Collect** open decision points from:
   - a research/design doc's "Decisions needed" / "Open decisions" / "Open scope" section —
     if a doc path is given as the arg, scope to it; otherwise scan `docs/research/*` for such
     sections (e.g. the A–D forks pattern),
   - `.ai/questions/` items routed for the maintainer,
   - any `.ai/decisions/` file marked pending/unresolved.
   Dedupe; skip anything already decided.
2. **Present** via the **AskUserQuestion** tool — one question per decision, concrete options
   from the source. **Every question MUST carry a recommendation**: the recommended option goes
   FIRST and its **label is prefixed `(Recommended)`** (front of the label — e.g.
   `"(Recommended) Resume X"` — not the description, or it isn't seen). Batch up to the tool's
   per-call limit (4); loop for the rest. Never dump decisions as prose.
3. **Record** each answer as an atomic file in `.ai/decisions/`. Allocate the id with the
   next-ID allocator — `node <claude-kit>/scripts/next-id.mjs decisions` (or
   `$CLAUDE_PLUGIN_ROOT/scripts/next-id.mjs`); NEVER hand-pick one. Capture: the decision, the
   chosen option, the why, the source doc/question, and the date. Honor an "Other"/free-text
   answer verbatim.
4. **Receipt** per `config.receipts` — one line per recorded decision (e.g.
   `→ HOD-D007 recorded (chose B)`).
5. Leave the source doc's recommendation text intact; **never edit ROADMAP**. If an answer
   contradicts the doc's recommendation, record the answer verbatim and note the divergence.
