# Skills library

**Non-proprietary**, broadly-useful Claude Code skills, versioned here so they
improve by iteration in one place. `bootstrap.sh` installs them (→
`~/.claude/skills/`); a project may also pin its own under `.claude/skills/`.

## Rules
- **Non-proprietary only** (public + MIT). A generic capability — managing the
  workflow, a research pass, a release checklist — belongs here. Anything encoding
  a specific product's domain or private process stays in that project / the
  private overlay.
- **One skill per directory:** `skills/<name>/SKILL.md` with the standard
  frontmatter (`name`, `description`) + body. Bundle helper scripts alongside.
- **Iterate in place.** Fix a misbehaving skill *here* so the improvement carries
  to every project; treat a recurring correction as a prompt bug to fix at source.
- Keep each skill **focused** — one capability, a description that makes when-to-use
  obvious.

## Index
| Skill | Purpose |
| --- | --- |
| [claude-kit](claude-kit/SKILL.md) | Manage work + tooling through the kit (workflow, setup, the shared inventory, public/private boundary) |
| [release-checklist](release-checklist/SKILL.md) | Pre-push/pre-release gate: tests, build, debug-leftover scan, version/changelog, commit hygiene → GO/NO-GO |
| [doc-audit](doc-audit/SKILL.md) | Find drift between docs and code: broken links, stale references, out-of-date examples, undocumented surface |
