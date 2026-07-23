---
id: KIT-T136
title: Board swimlanes — equal width, centered, guaranteed outer gutter, themed scrollbars
type: bug
status: review
priority: high
milestone:
labels: [ui, web-ui]
aka: []
parent:
introduced_by: KIT-T132
produced_by:
informs: []
links: [KIT-T132, KIT-T144]
files: [ui/src/components/KanbanBoard.css, ui/src/App.css]
tier:
model:
effort:
supersedes:
superseded_by:
created: 2026-07-23T10:52:00Z
updated: 2026-07-23T10:52:00Z
---

## Description
Chris (2026-07-23, UAT of the web UI):
1. "Swimlanes are not equal width. Should always be centered no matter how
   many swimlanes there are. Should always get a container with SOME outer
   margin."
2. "The standard GUI vertical scrollbars on swimlanes look like shit."

Causes: `.board-column { flex: 0 0 300px }` still lets the flex min-content
floor widen a lane when a card holds a long unbroken token; `.board-columns`
is start-aligned so the lane set hugs the left of the full-bleed main
(KIT-T144); `.column-content` shows default OS scrollbars.

Amends KIT-T144's "rather than centering" rationale: boards stay full-bleed,
but the lane set rides centered within that width with a guaranteed gutter.

## Acceptance Criteria
- [x] Every lane renders at the same width regardless of card content.
- [x] The lane set is horizontally centered for any lane count; when lanes
      overflow, the first lane stays reachable (safe centering + scroll).
- [x] Board pages keep a visible outer gutter at every viewport width.
- [x] Lane scrollbars are thin and theme-colored, not the OS default.

## Plan
1. KanbanBoard.css: `min-width: 0` + `overflow-wrap: anywhere` on lanes;
   `justify-content: center` (+ `safe center`) on the row; thin themed
   scrollbars on `.column-content` and `.board-columns`.
2. App.css: explicit inline padding on `.main--wide`; comment amended.

## Notes
Reported live during UAT — the first real acceptance pass on KIT-T132's UI.

## History
- [2026-07-23 10:52] (created) captured from UAT feedback, classified bug (ui area active — folded in)
- [2026-07-23 10:58] (fixed) CSS-only: min-width:0 + overflow-wrap on lanes, safe-center on the row, thin themed scrollbars, main--wide gutter. `npm run build` clean (vite, 15.25 kB css)
- [2026-07-23 10:58] (status) doing → review — CSS is visual; acceptance is Chris's eye on the board (config.uat none does not cover look-and-feel; parking in review for UAT)
