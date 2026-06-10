---
description: Close a ticket — the human-acceptance wrapper over `t status <id> done --human`
argument-hint: <ticket-id> [--fixed-commit <sha>]
---
`/done` is a THIN WRAPPER over the store mutation CLI (KIT-T075). It does not hand-edit the
ticket — closing is a structured mutation like every other status flip, so it runs:

```
node <kit>/scripts/t.mjs status $ARGUMENTS done --human
```

`t status … done` does all the work in ONE invocation:
- enforces `config.uat` — `--human` is the maintainer's explicit acceptance (KIT-D034). On a
  repo where uat resolves `none`, the agent may close directly with plain `t status <id> done`
  (no `/done` needed); `/done` is the path when acceptance is the human's call (`uat: required`).
- stamps the `(status) … → done` History line,
- runs the DONE TAIL — archives the file to `tickets/archive/`, and on a `bug`/`regression`
  prompts for `fixed_commit` (pass `--fixed-commit <sha>` to record the fixing commit),
- regenerates the board (INDEX / SUPERSEDED / REGRESSIONS) and ingests the cache.

Never set `status: done` by hand-editing frontmatter — that is the exact failure class the CLI
exists to remove (stale state, INDEX drift, skipped archive). Prose (Notes) stays direct-edit.
