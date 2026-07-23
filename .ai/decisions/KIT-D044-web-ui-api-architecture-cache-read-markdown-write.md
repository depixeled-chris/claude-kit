---
id: KIT-D044
title: "Web UI + API: cross-project hub, cache-READ / markdown-WRITE (bidirectional), mention inbox before dispatch"
date: 2026-07-23
supersedes:
source: maintainer request 2026-07-23 (KIT-T129) + questionnaire same day + mid-turn directive ("API uses database cache but writes go back through to the markdown as the source of truth")
links: [KIT-T129, KIT-D034]
---

**Decision:** claude-kit grows a local web UI + REST API (KIT-T129 epic), harvested in
pattern from D:\dev\workflow, native to the .ai store:

- **Cross-project hub** — ONE server over the machine registry + claude-kit-data
  central notebooks (the same discovery survey.mjs uses), not per-repo servers. The UI
  is the clickable form of /prime's WAITING-ON-YOU board.
- **Cache-READ / markdown-WRITE, bidirectional (maintainer directive):** markdown+YAML
  files remain the ONLY truth. Reads come from the per-project SQLite FTS5 cache (q.mjs
  surfaces; verifyCache staleness → rehydrate). Every write goes through the t.mjs code
  paths to the markdown files — status transitions (keeping the evidence floor +
  human_only guards), tick, link, comment appends — then view regen; the cache
  rehydrates on the next read. The API must never write the cache directly or let it
  become a second truth.
- **Phase-1 comment loop = durable comment + @mention + read-receipt pull** (the
  workflow harvest centerpiece, re-backed by markdown): a UI comment lands in the
  ticket file; unread mentions surface at drain/session-start; the acting agent acks.
  NO headless dispatch in phase 1 — that is its own phase-2 ticket with cost/
  concurrency guardrails designed first.
- **Localhost only** (127.0.0.1), no auth in phase 1; API shaped so auth bolts on for a
  later Hetzner/phone deploy.
- **Stack:** React 19 + Vite client (lifting workflow's Modal, kanban layout,
  activity-stream renderer, {data,meta} fetch convention), Express server with thin
  route→service layering. Server/client deps are opt-in tooling — the hooks and scripts
  stay dependency-free.

**Why:** The review backlog spans projects (12+ tickets parked in review across
KIT/CRX/…, 400+ open items overall) and commenting today means dropping items into an
active session — token-expensive, context-heavy. Durable, mention-addressed comments
let a tabula-rasa agent act without rebuilding context. Workflow's store was
DB-as-truth — the inverse of ours — so we lift its UI/API/comment patterns, never its
store layer (see KIT-T129 Notes for the full harvest verdict).

**Rejected:** per-repo servers (N servers, cross-project backlog stays blind);
comments in a server-side store (agents can't pick them up — defeats the point);
headless dispatch in phase 1 (token/concurrency guardrails must be designed first);
deploy-with-auth now (the .ai stores live on dev machines; the sync story is unsolved).
