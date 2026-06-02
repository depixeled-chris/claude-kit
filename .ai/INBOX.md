# INBOX

Raw capture. One line per idea — fire and forget. Triage drains this into
tickets/questions/decisions per `.ai/config.yml`. Promoted lines are deleted.

Format (cap.mjs writes this for you): `- [YYYY-MM-DD] (type) text`
The `(type)` is optional; untyped lines are classified at triage.

<!-- examples — delete these:
- [2026-06-02] (bug) login redirect loops after SSO
- [2026-06-02] (feature) dark-mode toggle persists across reloads
- [2026-06-02] (question) why is the token TTL 3600 and not configurable?
- [2026-06-02] form double-submits on slow network
-->

- [2026-06-02] (feature) Port all hooks to Node: session-orient (SessionStart), edit+commit scope gate (PreToolUse), flush-on-compact (PreCompact+Stop), pre-write code+doc-class checks, post-write lint/jscpd. Opt-in-aware: exit 0 unless project has .ai/.
- [2026-06-02] (feature) bootstrap.sh: install the Node hooks globally + compose the private overlay (public kit + ~/.claude/private/ or a private repo).
- [2026-06-02] (feature) Expand README + STRATEGY: kit is source-of-truth for ALL tooling + a research KB + an agent library, not just the workflow.
- [2026-06-02] (chore) Migrate existing ~/.claude tooling into the kit (current bash hooks + global CLAUDE.md rules); make ~/.claude a derived install; delete the hand-wired bash hooks once Node ports verify.
- [2026-06-02] (chore) Per-doc classify the hustle-or-die docs/research → extract generic cores into research/, leave product-specific behind. Never import anything citing proprietary/unlicensed frameworks.
- [2026-06-02] (feature) Seed agents/ with the generic agent roles we actually reuse (researcher, code-reviewer, refactorer, test-author).
- [2026-06-02] (chore) Migrate hustle-or-die's repo-root ROADMAP.md/DECISIONS.md onto the .ai/ model (consume the kit) once the kit's hooks/overlay land.
