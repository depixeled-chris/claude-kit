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

- [2026-06-02] (idea) Agent-assignment attribution on ticket history (who/which-agent did what) — DEFERRED per maintainer 2026-06-02; not needed yet. Prior art: workflow repo `agent_assignments`. If multi-agent accountability becomes real, add an actor field to History events (not a table).
- [2026-06-02] (bug) commit-gate inspects the SESSION repo (process.cwd()), not the repo a `cd X && git commit` actually targets — so committing repo B from a session in repo A guards A's tree (wrong files; over/under-blocks). Resolve the commit's real target (parse leading `cd`/`git -C`, handle MSYS `/d/` vs `D:\` paths) before reading `changed`. Surfaced 2026-06-02 dogfooding the kit from a hustle-or-die session.
- [2026-06-02] (feature) Expand README + STRATEGY: kit is source-of-truth for ALL tooling + a research KB + an agent library, not just the workflow.
- [2026-06-02] (chore) Make ~/.claude a fully DERIVED install end-to-end: run bootstrap to symlink commands/skills/agents (needs WSL on native Windows — currently hooks were hand-copied). (Done 2026-06-02: global CLAUDE.md split into public base user-config/CLAUDE.global.md + private overlay ~/.claude/private/CLAUDE.md and composed live; all 8 hooks are Node + wired; legacy bash deleted.)
- [2026-06-02] (chore) Per-doc classify the hustle-or-die docs/research → extract generic cores into research/, leave product-specific behind. Never import anything citing proprietary/unlicensed frameworks.
- [2026-06-02] (chore) Migrate hustle-or-die's repo-root ROADMAP.md/DECISIONS.md onto the .ai/ model (consume the kit) once the kit's hooks/overlay land.
<!-- DONE 2026-06-02: seeded agents/ (researcher, code-reviewer, refactorer, test-author)
     and skills/ (release-checklist, doc-audit). research-pass intentionally skipped — it
     overlaps the new researcher agent + the bundled deep-research skill. -->
<!-- DONE 2026-06-02: hustle-or-die already migrated to .ai/ (root ROADMAP/DECISIONS ->
     .ai/), so the "migrate once kit lands" line above is itself stale; kept only as a
     reminder to make hod CONSUME the kit's installed hooks/template rather than its own
     copies. -->
<!-- NOTE: hustle-or-die already consumes the .ai/ model; the line above tracks switching
     it to the kit's shared tooling, not re-migrating. -->

<!-- DROPPED 2026-06-02 (obsolete): no .claude/journal/ exists — the breadcrumb-writing
     pre-compact-snapshot.sh was retired; PreCompact is now flush.mjs (reminder-only, no
     file writes), matching STRATEGY. Nothing to gitignore. Revisit only if we add
     auto-snapshotting on compact (a new feature, not this chore). -->
