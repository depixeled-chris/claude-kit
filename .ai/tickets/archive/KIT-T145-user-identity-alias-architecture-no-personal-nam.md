---
id: KIT-T145
title: User identity/alias architecture — no personal names in code; role 'user' resolved via KIT_USER/registry; /api/me
type: feature
status: done
priority: high
milestone: M4-web-ui
labels: []
links: [KIT-D044, KIT-T130]
files: []
supersedes:
superseded_by:
created: 2026-07-23T18:13:57Z
updated: 2026-07-23T18:39:56Z
---

## Description
Maintainer directive 2026-07-23: NO code outside .ai/ may mention the maintainer by
name — hardcoded "chris" makes the kit unusable for anyone else. The human is a ROLE
(user), with a configurable alias. Sweep found (Grep 2026-07-23): ui
StatusControls.tsx:32 (agent: 'chris'), CommentForm.tsx:16 (author default),
TicketDetail.tsx:20 (VIEWER const); scripts/survey.mjs:137 (heading regex includes
'chris'); test fixtures in server.test.mjs + comments.test.mjs + test-hooks.mjs;
prose comments in hooks/land-alert.mjs; and the `answerable_by: chris` vocabulary in
commands/drain.md + decide.md (+ the config template) — the schema itself encodes the
name.

Design:
- Resolution chain (mirror of $KIT_AGENT): env `KIT_USER` → registry `user` field
  (~/.claude/claude-kit-projects.json) → literal fallback `user`.
- Server: GET /api/me → { alias }; write endpoints default author/agent to it.
- UI: fetch /api/me once (context/provider); viewer identity, comment author default,
  and status agent all come from it — zero name literals.
- survey.mjs heading regex: generic roles (you|maintainer|user) + the resolved alias
  dynamically, since .ai DATA may legitimately name the person.
- Schema: `answerable_by` vocabulary becomes `user` in kit templates/commands/docs;
  readers accept the legacy personal value as a synonym at read time (no store
  migration required — .ai data may keep names).
- Enforcement: a regression test asserting no personal-name literals in ui/src,
  server (excl. node_modules), scripts, hooks, commands — the denylist read from the
  registry user field + a fixture list, so the test itself stays name-free.

## Acceptance Criteria
- [x] Identity resolver shipped (KIT_USER → registry user → 'user') and exposed as GET /api/me; t/comments CLI default human author through the same resolver
- [x] ui/src has zero personal-name literals: viewer, comment author default, status agent all resolved from /api/me
- [x] survey.mjs regex + test fixtures + hook comments de-named; commands/docs use `answerable_by: user` with legacy value accepted as synonym on read
- [x] Regression test proves no personal-name literals outside .ai/ (excl. node_modules), name sourced from config not the test body
- [x] ui build + full npm test green

## Plan
1. Resolver in scripts (beside resolveAgent in comments.mjs) + /api/me + CLI default.
2. UI identity context; replace the three literals.
3. De-name survey regex/fixtures/docs; answerable_by synonym read.
4. Regression test + suite.

## History
- [2026-07-23 18:13] (created) feature — User identity/alias architecture — no personal names in code; role 'user' resolved via KIT_USER/registry; /api/me
- [2026-07-23 18:25] (status) todo → doing
- [2026-07-23 18:39] (comment) ticked: Identity resolver shipped (KIT_USER → registry user → 'user') and exposed as GET /api/me; t/comments CLI default human author through the same resolver
- [2026-07-23 18:39] (comment) ticked: survey.mjs regex + test fixtures + hook comments de-named; commands/docs use `answerable_by: user` with legacy value accepted as synonym on read
- [2026-07-23 18:39] (comment) ticked: ui build + full npm test green
- [2026-07-23 18:39] (comment) ticked: ui/src has zero personal-name literals: viewer, comment author default, status agent all resolved from /api/me
- [2026-07-23 18:39] (comment) ticked: Regression test proves no personal-name literals outside .ai/ (excl. node_modules), name sourced from config not the test body
- [2026-07-23 18:39] (comment) @claude: Evidence: root npm test green (identity.test.mjs 6/6 incl. resolver chain + no-personal-name scan across ui/src+server+s (full comment #1 in ## Notes)
### comment #1 [2026-07-23 18:39] @claude
Evidence: root npm test green (identity.test.mjs 6/6 incl. resolver chain + no-personal-name scan across ui/src+server+scripts+hooks+commands; server.test.mjs 18/18 incl. GET /api/me → 200). ui build green (tsc -b && vite build, 67 modules). Shared files writes.mjs/api.ts/types landed via 6b479bc (parallel KIT-T137 co-commit); identity.mjs/me.mjs/identity.tsx complete the dependency here.
- [2026-07-23 18:39] (status) doing → done
