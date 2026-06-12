# Glossary — Claude Code internals, plain English

What the moving parts actually do, so the strategy isn't a black box.
Grounded against Claude Code v2.1.160; specifics marked *(version-fragile)*
should be re-checked on your installed version.

### Compaction (`/compact`)
When the conversation nears the context limit, Claude Code rewrites the whole
chat into a shorter prose summary and continues from that. **It is lossy by
design** — it paraphrases, so exact strings get dropped. Standing instructions
(system prompt, project-root `CLAUDE.md`, auto-memory) are re-injected from disk;
the live conversation is what gets summarized. *This is the root cause of
"amnesia," and why state belongs in files.*

### `/clear`
Throws away the conversation entirely and starts fresh (keeps `CLAUDE.md` etc.).
Cheaper and cleaner than `/compact` when you've hit a milestone — pair with a
re-prime. Prefer it over riding one giant session for days.

### CLAUDE.md
Instruction files loaded into every session. Hierarchy: user
(`~/.claude/CLAUDE.md`) → project (`./CLAUDE.md`) → nested dirs (loaded on demand
when a file in that dir is read). **Adherence is soft** — it's guidance, not
enforcement. For must-happen-every-time behavior, use a hook. Project-root
`CLAUDE.md` survives compaction (re-injected); nested ones don't until
re-triggered.

### Auto-memory
`~/.claude/projects/<project>/memory/MEMORY.md` + topic files — notes Claude
accumulates per repo. **Machine-local; does not sync.** Useful per-machine, but
anything cross-machine must be promoted into `.ai/` or `CLAUDE.md`.

### Native task list (`TaskCreate` / `TaskUpdate` / `TaskList`)
The in-session to-do list that drives the UI progress spinner, stored under
`~/.claude/tasks/<session>/`. **Per-session and machine-local** — great as a live
mirror of a ticket's acceptance criteria, useless as the durable record. The
ticket file is the truth.

### Subagents (the Task/Agent tool)
Spawn a separate agent with its own context window to do search/exploration; it
burns tokens reading files and returns a distilled answer, keeping your main
thread lean. Built-ins: `Explore` (fast read-only search), `Plan` (read-only
planning), `general-purpose`. Use them so big file dumps don't bloat the main
context and trigger compaction.

### Hooks
Shell/Node/HTTP/prompt actions Claude Code runs at lifecycle events. Core,
verified events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`Stop`, `PreCompact`. *(Many more exist but names are version-fragile — confirm
before relying on them.)* This is how you make a behavior non-optional.

### Plan mode (Shift+Tab)
Claude researches and proposes without editing; you approve before any change.
The native version of "discuss scope before touching files."

### Statusline
A script at the bottom bar fed session JSON on stdin (model, `context_window`,
cost, branch, `session_id`). No token cost. The kit ships one showing
`ctx:NN%` so you know when to flush.

### Sessions / resume
`claude --continue` (most recent here), `claude --resume` (picker). Stored at
`~/.claude/projects/<project>/<id>.jsonl`, cleaned after ~30 days
*(version-fragile)*. **Do not resume across machines** — IDs and paths are
machine-local. Use `git pull` + fresh session + re-prime instead.

### Scheduling (recurring / background agents)
- `/loop` — recurring prompt *within* a running session (needs the session open).
- `CronCreate` — local cron; durable form writes `.claude/scheduled_tasks.json`.
- `RemoteTrigger` — cloud-run via `/v1/code/triggers`.
(*Ignore any "routines `/fire` curl" with an `experimental-cc-routine` header —
that was a research hallucination, not a real endpoint.*)
