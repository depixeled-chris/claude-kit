---
id: KIT-T139
title: All-boards sections default to collapsed, including review-bearing projects
type: feature
status: review
priority: medium
milestone:
labels: [ui, web-ui]
aka: []
parent:
introduced_by:
produced_by:
informs: []
links: [KIT-T144]
files: [ui/src/components/ProjectSection.tsx]
tier:
model:
effort:
supersedes:
superseded_by:
created: 2026-07-23T11:52:00Z
updated: 2026-07-23T11:52:00Z
---

## Description
Chris (2026-07-23, UAT): sections on /all "should default to collapsed."
Amends KIT-T144's default (collapsed unless the project has review items —
those opened expanded). Now: every section defaults collapsed on first
visit; the persisted localStorage state (already shipped in T144) still wins
once the user toggles.

## Acceptance Criteria
- [x] A project never seen before renders collapsed on /all, review items or
      not; a stored toggle still overrides.

## Plan
1. ProjectSection: defaultCollapsed = true; comment updated.

## History
- [2026-07-23 11:52] (created) captured from UAT interjection; the persistence half of the ask already existed (KIT-T144) — only the default changes
- [2026-07-23 11:56] (fixed) one-line default flip + comment; ui build clean [no-test: one-line default; behavior is a browser UAT check]
- [2026-07-23 11:56] (status) doing → review — default-collapsed feel is Chris's UAT
