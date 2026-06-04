---
id: KIT-D017
title: "The always-on operating loop — spitball → capture → delegate → questionnaire, drain never idle"
date: 2026-06-04
supersedes:
source: conversation 2026-06-04 (maintainer directive)
links: [KIT-D015, KIT-D002, KIT-T015]
---

**Decision:** claude-kit's interactive mode is a continuous, non-blocking loop with four roles
that run AT ALL TIMES, not on request:
1. **Maintainer spitballs** — fires observations/bugs/asks freely, off the top, mid-work.
2. **Capture** — every actionable item is logged the instant it lands, as its OWN item; never
   conflated with another just because they were said together; never dropped.
3. **Delegate** — work is dispatched to background subagents and the DRAIN NEVER GOES IDLE. When
   a wave finishes, the next captured items are dispatched immediately — the orchestrator does not
   sit between waves doing only bookkeeping. Agents run while the conversation continues.
4. **Questionnaire** — genuine open decisions (the ones only the maintainer can make) are batched
   and surfaced via AskUserQuestion, recommended option first with "(Recommended)" at the FRONT of
   the label — never buried in prose, never left implicit. The maintainer always knows what input
   is pending from them.

**Architecture (the shape this produces):** ONE long-lived orchestrator context (the main loop)
that is safe to `/clear` at any moment because all state is on disk (KIT-D015), plus MANY short,
well-informed agent contexts that are correct because they are grounded in the ticket/doc
provenance (KIT-D018). The long context can be discarded and rebuilt freely; the short contexts
are cheap, parallel, and disposable. Capture + provenance are what make both halves work.

**Why:** The maintainer must be able to think out loud and trust the system to route, work, and
resurface decisions — without babysitting, without repeating himself, without the drain stalling.
The failures this fixes, all observed in one session: the drain went idle between waves (agents
finished, nothing redispatched); decisions were made unilaterally and recorded but not surfaced
for the maintainer to answer; and reactive single-edits replaced continuous delegation. This loop
+ KIT-D015 (lose nothing on /clear) + KIT-D002 (enforced by hooks) is the core of the tool.
Rejected: blocking on each interjection (kills the spitball flow) and deferring capture to a
"natural break" (that break is where requests die).
