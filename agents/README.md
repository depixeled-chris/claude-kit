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
| [researcher](researcher.md) | Read-only investigation (codebase + web); returns sourced answers with pointers | Read, Grep, Glob, Bash, WebSearch, WebFetch |
| [code-reviewer](code-reviewer.md) | Reviews changes for correctness/security/maintainability; reports, doesn't fix | Read, Grep, Glob, Bash |
| [refactorer](refactorer.md) | Behavior-preserving restructure, verified with tests | Read, Grep, Glob, Edit, Write, Bash |
| [test-author](test-author.md) | Writes + runs real automated tests (red→green for bugs) | Read, Grep, Glob, Edit, Write, Bash |
