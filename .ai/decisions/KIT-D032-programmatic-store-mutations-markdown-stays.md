---
id: KIT-D032
title: "Structured store mutations are programmatic (t CLI); format stays markdown + YAML frontmatter"
date: 2026-06-09
supersedes:
source: conversation 2026-06-09 (maintainer interjection during M1 drain)
---

**Decision:** Structured fields of .ai items (status, criteria checkboxes, links,
supersede pairs) are mutated through a dedicated CLI (`t` — KIT-T075) that enforces the
invariants: valid transitions, `human_only` guard, auto-appended History line, index
regeneration and cache ingest in the same invocation. Hand-editing the files remains
correct ONLY for prose (Description, Notes). The storage format stays markdown with
YAML frontmatter — a move to pure YAML is REJECTED.

**Why:** Every store-integrity failure in the 2026-06-09 review was a hand-edit
failure (stale `doing` on T048, INDEX drift, template placeholder text in shipped
supersede fields, self-asserted statuses) — the invariants need one owner, not N agent
edits. The read path is already programmatic (q/SQLite, KIT-T026); this completes the
write path. Format: the structured half already IS YAML (frontmatter); the prose half
is where markdown wins (renders, line-diffs, natural authoring), and pure-YAML
documents make long prose fragile — one indentation slip corrupts the file, while
frontmatter damage is contained. The pain was ad-hoc mutation, not the format.
