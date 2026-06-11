---
id: KIT-T079
title: "Provenance-first: agent edited/debugged a module without checking git history, missed a superseded duplicate"
type: bug
status: done
priority: high
milestone:
labels: [process, provenance, agent-discipline, code-graph]
files:
  - scripts/code-graph.mjs
links: []
supersedes:
superseded_by:
created: 2026-06-10T00:00:00Z
updated: 2026-06-11T04:24:58Z
---

## Description
Lived failure (hustle-or-die, 2026-06-10). The maintainer reported "I don't see the octave UI"
in the roads editor. The agent chased browser-cache / zombie-dev-server theories for several turns
before discovering the repo had **two** roads editors: the canonical `rapid-game/editor` (the
HOD-T114 convergence target, where the work correctly landed) and a **superseded** HOD-local pair
`tools/editor` + `tools/road-preview` (the pre-convergence unified editor). The git history said so
outright — `c6f5b04 unified editor is a React app`, `be3472e port Roads + Humanoid into the unified
editor`, then the convergence moved to `rapid-game/editor` — but the agent never ran `git log` on
the paths or enumerated entry points before forming theories. Maintainer: "The provenance and GIT
history could've fucking told you that, so PROCESS FAILURE."

Root cause: when a question is about **module identity** ("which editor?", "why isn't X showing?",
"is this the right file?"), the first move must be provenance (git log on the path + entry-point /
duplicate-definition enumeration), NOT runtime hypotheses. The KIT closes grep paths (query-gate)
but offers no fast "is this module duplicated / superseded?" signal, so a blank-context agent can
edit one of two twins and not notice.

## Acceptance Criteria
- [x] `code-graph` gains a duplicate-surface query — e.g. `--query duplicate-defines <symbol>` and/or
      `--query entry-points` (multiple `index.html` / vite roots / `main.{ts,tsx}`) — so "is there
      more than one X?" is one command, not a multi-turn discovery.
- [x] The query flags when one twin is superseded (no inbound importers from shipped code / only
      self-referential closure) so the canonical one is obvious.
- [x] Drain/work guidance (CLAUDE.md or the relevant skill) states the rule: on a module-identity or
      "not showing" question, run provenance (`git log -- <path>`, code-graph entry-points/duplicates)
      BEFORE runtime theories. Cite this ticket.
- [x] Test for the new code-graph query against a fixture with a duplicated factory.

## Notes
- 2026-06-10: The duplicate was deleted in hustle-or-die (`tools/editor` + `tools/road-preview`
  removed; `preview:roads` script dropped) once provenance + `code-graph importers-of` confirmed the
  closure was self-contained — exactly the check that should have run at minute one.
- Adjacent: KIT-T080 (the query-gate false-positive hit while authoring this ticket). Same theme —
  retrieval ergonomics — but a distinct defect.
- 2026-06-10 (implemented): added `--query duplicate-defines <symbol>` + `--query entry-points` to
  `scripts/code-graph.mjs` (reusing the existing graph index — no new parser; both fail-open to an
  empty, well-formed result). Superseded-twin rule: a definer whose ONLY inbound importers live in
  its own top-level subtree (self-referential closure / none at all) is flagged `superseded:true`;
  a twin imported from OUTSIDE its subtree is canonical (`superseded:false`). Conservative — when no
  twin is externally imported it flags NEITHER (can't-tell, not "dead"), so it never lies. On the
  duplicated-`createRoadEditor` fixture (canonical `rapid/editor` imported by `src/main.ts`; dead
  `tools/editor` reached only by `tools/preview.ts`):
    duplicate-defines → rapid/editor/index.ts {externalImporters:[src/main.ts], superseded:false},
                        tools/editor/index.ts {externalImporters:[], superseded:true}
    entry-points      → entries:[index.html, src/main.ts, tools/index.html], multiRoot:true
  Provenance-first prose (cite KIT-T079) added to the query-gate redirect (`hooks/query-gate.mjs`
  graphMsg), the SessionStart PROCESS RULES (`hooks/orient.mjs`), and the project contract snippet
  (`project-template/CLAUDE.snippet.md` → Working a ticket). Tests: `scripts/code-graph.test.mjs`
  33 passed / 0 failed (+15 new); `scripts/test-hooks.mjs` 111 passed; `npm test` green.

## History
- [2026-06-10 00:00] (created) provenance-first bug from a lived HOD roads-editor mix-up; status→todo.
- [2026-06-11 04:17] (status) todo → doing
- [2026-06-11 04:24] (comment) ticked: `code-graph` gains a duplicate-surface query — e.g. `--query duplicate-defines <symbol>` and/or
- [2026-06-11 04:24] (comment) ticked: The query flags when one twin is superseded (no inbound importers from shipped code / only
- [2026-06-11 04:24] (comment) ticked: Drain/work guidance (CLAUDE.md or the relevant skill) states the rule: on a module-identity or
- [2026-06-11 04:24] (comment) ticked: Test for the new code-graph query against a fixture with a duplicated factory.
- [2026-06-11 04:24] (status) doing → done
