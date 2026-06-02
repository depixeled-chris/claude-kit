# Agent library

**Non-proprietary** subagent definitions, versioned here so they improve by
iteration in one place instead of being re-invented per project. `bootstrap.sh`
installs them (→ `~/.claude/agents/`); a project may also pin its own under
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
  tools, not Write/Edit.

## Index
| Agent | Role | Tools |
| --- | --- | --- |
| _(none yet — seed with the generic roles we actually reuse)_ | | |
