---
id: KIT-T080
title: "query-gate RULE 1 blocks a targeted read of a SPECIFIC store file (e.g. .ai/config.yml), contradicting its own allowed-case"
type: bug
status: todo
priority: medium
milestone:
labels: [hooks, query-gate, false-positive, retrieval]
files:
  - hooks/query-gate.mjs
  - hooks/query-gate.test.mjs
links: [KIT-T079]
supersedes:
superseded_by:
created: 2026-06-10T00:00:00Z
updated: 2026-06-10T00:00:00Z
---

## Description
`query-gate.mjs` RULE 1 (`store-grep`) blocks ANY search/read tool whose command matches the STORE
regex, with NO exemption for a targeted read of ONE specific named file:

```js
if ((isSearch || isRead || isFind) && STORE.test(c)) return { id: 'store-grep', msg: storeMsg(c) };
```

This fires on `sed -n '1,80p' .ai/config.yml` — a plain paginated READ of a single, known config
file. Three defects:

1. **Contradicts the gate's own stated allowed-case.** The header says: *"ALLOWED (the maintainer's
   rule): a targeted grep of a SPECIFIC named file."* RULE 2 (`source-discovery`) honors this via
   `targetsOneFile`. RULE 1 does NOT — it blocks the specific-file case it claims to allow.
2. **`config.yml` is not a `q`-indexed work item.** The remediation lists only `q governing/trail/
   fts/open` — none can return `config.yml` (it is the schema, not a ticket/decision/note). So the
   gate forbids the read AND every suggested alternative is a dead end. (Same for `SESSION.md`,
   `SUPERSEDED.md`, `REGRESSIONS.md` — store files `q` does not surface as queryable items.)
3. **`sed -n 'N,Mp'` is pagination (a read), not a search.** It is classed as `isSearch` purely
   because `sed` is in the SEARCH set. A read of a known file should route to the **Read tool**, which
   the message never mentions.

Net: authoring KIT-T079 required reading `config.yml`; the gate blocked the bash read and pointed at
queries that cannot retrieve it. Workaround was the Read tool — which is the right answer the message
should have given.

## Acceptance Criteria
- [ ] RULE 1 exempts a targeted read/grep of ONE specific named store file (mirror RULE 2's
      `targetsOneFile`), so `sed -n '1,80p' .ai/config.yml` / `grep <pat> .ai/config.yml` pass while a
      TREE-WIDE or pattern-discovery search of the store still blocks.
- [ ] For a plain READ tool (`cat/head/tail/sed -n/type/gc`) of a specific store file, the message
      (if it still blocks anything) points at the **Read tool**, not only `q` graph queries.
- [ ] `config.yml` (and the non-queryable top-level state files) never route to `q` remediation that
      cannot return them.
- [ ] `query-gate.test.mjs` gains cases: targeted read of `.ai/config.yml` is ALLOWED; a recursive /
      pattern search of the store is still BLOCKED (no regression to RULE 1's real purpose).

## Notes
- Do NOT broaden into "allow grepping the store" — the gate's purpose (use `q` for work-graph queries
  with links/history) is correct. The fix is the SPECIFIC-FILE carve-out the header already promises,
  plus read-vs-search routing. Per the HOOK CONTRACT this was surfaced for the maintainer, not
  silently loosened.
- Surfaced 2026-06-10 by the maintainer ("IF THE GATE BLOCKS TEXT SEARCHING, THAT'S A BUG") while the
  agent read `config.yml` to author KIT-T079.

## History
- [2026-06-10 00:00] (created) query-gate specific-file false-positive; status→todo.
