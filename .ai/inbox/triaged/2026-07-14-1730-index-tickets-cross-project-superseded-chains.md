(bug) index-tickets.mjs writes cross-project + comment-garbage SUPERSEDED chains

Running `node D:\dev\claude-kit\scripts\index-tickets.mjs D:\dev\groovegrid`
(repo with 2 GG tickets, zero supersessions) produced .ai/SUPERSEDED.md
containing KIT-* chains from another project AND a chain parsed from the
ticket template's comment line:
  "# ticket id this one RETIRES (set on the NEWER ticket)" → KIT-T044
Two defects: (1) supersession chains leak across project scopes instead of
being filtered to the target repo's key; (2) the parser reads frontmatter
comments / _TEMPLATE.md as real values. Fix at the kit source per the hook
contract, not per-project. Could not locate the kit's own inbox from the
groovegrid session (D:\dev\claude-kit has no .ai/; central store path not
discoverable via q.mjs usage) — hence captured here.

[re-capped 2026-07-14 from groovegrid inbox at triage — cap said KIT-scope, triage cannot rescope]
