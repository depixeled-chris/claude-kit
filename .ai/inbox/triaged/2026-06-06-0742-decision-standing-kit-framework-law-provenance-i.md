(decision/standing, KIT framework law) PROVENANCE IS MANDATORY & ENFORCED.

TRAIL NODES (all first-class): tickets, decisions, RESEARCH/DESIGN DOCS (docs/research, docs/design, docs/strategy — e.g. R050), requests, and commits. Documentation is part of the trail, not separate from it.

(1) TRAIL-IN-ITEM, INCEPTION-OUT — at the moment an item is created or related, IT records links OUT to its ANTECEDENTS: the ORIGIN it came from (request / research effort / parent ticket / decision) plus the decisions and docs that informed it. One direction only: inception -> origins. NOT bidirectional — the reverse (what descends from X) is derivable by query (backlinks), never hand-authored.

(2) THE TRAIL IS A GRAPH AROUND THE ORIGIN — a ticket came from SOMETHING, and that something may ALSO have spawned research docs, decisions, and sibling tickets. So an item's trail = walk OUT to its origin, then gather everything that origin spawned (decisions + docs + related tickets), transitively to the root decisions. Acting on one item means seeing its whole lineage, not just a single parent link.

(3) TRAIL-ON-ACTION — any time work begins on an item, a SUMMARY of its trail MUST be surfaced programmatically before acting (DECISIONS first, then DOCS, then related tickets); never depend on the agent's memory.

ENFORCED BY HOOKS: q trail <id> (walk outbound links to the origin + its spawned decisions/docs/tickets, summarize, decisions+docs first); a ticket-start gate that surfaces the decision/doc trail and blocks acting on a trail-less item; a lint that flags an item with no outbound antecedent link. Research/design docs must be indexed as trail nodes (KIT-T041/T042) so they can be linked + walked.

ROOT CAUSE: HOD-D003 (Rust owns world-gen) and R050 (the world design doc) never surfaced while working HOD-T106 because T106 linked OUT to a wrong record (HOD-D017) instead of to its true origin (D003 + the world-gen epic + R050). Cross-project. Project: KIT.
