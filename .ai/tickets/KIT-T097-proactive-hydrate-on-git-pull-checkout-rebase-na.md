---
id: KIT-T097
title: Proactive hydrate on git pull/checkout/rebase — native .githooks (post-merge/checkout/rewrite via core.hooksPath) + a PostToolUse(Bash) complement; closes the out-of-band drift gap (KIT-T096 follow-up)
type: feature
status: doing
priority: medium
milestone:
labels: []
links: [KIT-T096]
files:
  - .githooks/post-merge
  - .githooks/post-checkout
  - .githooks/post-rewrite
  - scripts/install-git-hooks.mjs
  - hooks/git-pull-hydrate.mjs
  - hooks/hooks.json
supersedes:
superseded_by:
created: 2026-06-16T17:00:12Z
updated: 2026-06-16T17:01:05Z
---

## Description
Follow-up to [[KIT-T096]]: hydrate-at-write covers in-process item mutations, but it CANNOT cover
OUT-OF-BAND changes — a `git pull` (the other machine / a parallel session pushed to the shared
`claude-kit-data` repo), a branch `checkout`, a rebase. Today those wait for the lazy read-self-heal
audit. Close that proactively: hydrate the moment pulled changes land.

Two complementary surfaces:
1. **Native git hooks** (catch MANUAL terminal pulls too): `post-merge` (git pull = fetch+merge;
   fires on merge incl. fast-forward), `post-checkout` (branch switch / clone), `post-rewrite`
   (`pull --rebase` / `commit --amend`). Each runs `hydrate-db.mjs` cross-scope, fail-open.
   `git reset --hard` fires no hook — stays on the read-self-heal audit (documented limit).
2. **`PostToolUse(Bash)` complement** (zero-install, catches AGENT-run git ops): a hook that
   detects `git pull|merge|checkout|switch|rebase` in the Bash command and hydrates after.

KEY placement: pulled ITEM changes land in the **`claude-kit-data`** repo (centralized projects'
`.ai/` are junctions into it) — NOT the code repos. So the native hooks must be installed on
`claude-kit-data` (covers EVERY centralized project in one shot) + `claude-kit` (its own in-repo
`.ai`) + any local-mode project repo. Shared hook scripts live in `<plugin>/.githooks/`; each repo
opts in via `git config core.hooksPath <plugin>/.githooks` (NOT committed — a per-clone install
step). `core.hooksPath` is all-or-nothing per repo, so the installer MUST guard: if the target repo
already sets `core.hooksPath` or has non-sample `.git/hooks`, WARN and skip (never clobber a repo's
existing hooks, e.g. husky on a code repo) — claude-kit-data is a pure data repo so it's safe.

## Acceptance Criteria
- [ ] `.githooks/{post-merge,post-checkout,post-rewrite}` — POSIX `sh` (git ships bash on Windows so `#!/bin/sh` runs cross-platform), each resolves the plugin via its own `$0` dir and runs `node "$DIR/../scripts/hydrate-db.mjs"` (cross-scope), fail-open (a hydrate error never fails the git op).
- [ ] `scripts/install-git-hooks.mjs [repoPath]` — sets `core.hooksPath` to the absolute `<plugin>/.githooks` on the target repo; GUARDS: warn + skip if the repo already has a different `core.hooksPath` or non-sample files in `.git/hooks` (don't clobber). Idempotent (re-run = no-op if already ours).
- [ ] `hooks/git-pull-hydrate.mjs` — `PostToolUse(Bash)`: if the command matches a git pull/merge/checkout/switch/rebase, run `hydrate({ifStale:true})` cross-scope; exit 0 always, fail-open, no-op on unadopted / non-git commands. Registered in `hooks.json` PostToolUse(Bash) + kept in parity with `user-config/settings.recommended.json`.
- [ ] `init-project` calls `install-git-hooks` for the adopted repo (or the central data repo) so new adoptions get it.
- [ ] Installed on `claude-kit-data` + `claude-kit` as part of this ticket (the live high-leverage targets).
- [ ] Test: `git-pull-hydrate.mjs` triggers on a pull-shaped command + no-ops otherwise; the installer sets/guards core.hooksPath correctly; a post-merge dry-run hydrates. `npm test` green.

## Plan
1. `.githooks/` three sh hooks → shared inner `node hydrate-db.mjs` cross-scope (fail-open).
2. `scripts/install-git-hooks.mjs` — set+guard core.hooksPath; idempotent.
3. `hooks/git-pull-hydrate.mjs` + register in hooks.json + settings.recommended (parity).
4. Wire install into `init-project`; install on claude-kit-data + claude-kit.
5. Tests; `npm test` green. Document the `reset --hard` limit (stays on the audit).

## History
- [2026-06-16 17:00] (created) feature — Proactive hydrate on git pull/checkout/rebase — native .githooks (post-merge/checkout/rewrite via core.hooksPath) + a PostToolUse(Bash) complement; closes the out-of-band drift gap (KIT-T096 follow-up)
- [2026-06-16 17:01] (status) todo → doing
