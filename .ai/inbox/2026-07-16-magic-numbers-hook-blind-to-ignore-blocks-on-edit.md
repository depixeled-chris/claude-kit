(bug) pre-write magic-numbers gate blocks Edit diffs INSIDE claude-kit-ignore-start/end blocks

Observed 2026-07-16 in groovegrid: editing a numeric tuple line inside an
established `claude-kit-ignore-start magic-numbers` … `end` block (the
*PanelSpec.h placements arrays — every such file wraps them) gets BLOCKED when
applied via the Edit tool, but the identical content applied via Write
(full-file) passes. The hook evidently evaluates the Edit PAYLOAD (old/new
strings) without resolving the surrounding ignore-block scope in the target
file, so per-line context is lost. Effect: anyone editing already-excluded
lines via Edit gets a false block and is pushed toward Write-whole-file (worse
tool for the job) or adding redundant per-line markers.

Fix: pre-write.mjs must locate the edit's position in the CURRENT file text
and honor enclosing start/end markers before flagging, same as it does for
whole-file scans. Repro: any Edit changing a number inside
groovegrid/src/ui/tracks/effect-panels/ContinuumPanelSpec.h placements.
