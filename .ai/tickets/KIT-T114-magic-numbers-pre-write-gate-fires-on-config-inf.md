---
id: KIT-T114
title: MAGIC-NUMBERS PRE-WRITE GATE FIRES ON CONFIG / INFRA FILES — false positive. Hit 2026-06-12 writing a Docker/nginx/Let's-Encrypt deploy for client-rx-clinical (CRX-T004): the gate blocked `EXPOSE 3000` in a Dockerfile, and would equally block `listen 443 ssl;` / `listen 80;` in nginx conf, `rsa_key_size=4096` and `sleep 6h` in a bootstrap shell script, and port mappings in docker-compose.yml. These are conventional infrastructure constants (ports, RSA key sizes, renewal intervals) that are NOT extractable code constants — a Dockerfile `EXPOSE` takes a literal; nginx `listen` requires the literal port; compose `ports:` are literals. PROFILE of the false positive: the check is meaningful for application source (JS/TS) but not for config/infra file TYPES. FIX options: (a) default-exclude config file types from magic-numbers in the hook itself — YAML at minimum (it's used almost exclusively for config, Chris's call), and strongly consider Dockerfile, `*.conf`/nginx, and shell `.sh`; (b) keep the check restricted to the languages code-graph indexes (JS/TS) the way source-discovery greps are scoped (cf. KIT-T085); (c) ship a default `.claude-kit-ignore.yaml.example` that pre-excludes these infra globs. Worked around for now with a project-level `.claude-kit-ignore.yaml` in client-rx-clinical (magic-numbers excludes Dockerfile, docker-compose.yml, nginx/**, init-letsencrypt.sh, **/*.yaml, **/*.yml) — but that per-project patch shouldn't be necessary; the gate should not treat config/infra literals as magic numbers by default.
type: bug
status: todo
priority: high
milestone:             # blank = backlog; set to schedule onto ROADMAP.md
labels: []
aka: []                # prior ids/labels this item was known by (populated by rekey-ids)
parent:                # id of the parent item (epic/request) this belongs to — upward link only; children generated
introduced_by:         # bug provenance: ticket@commit or ticket-id that introduced this bug (KIT-T095)
produced_by:           # doc provenance: id of the source doc/item that produced this work item (KIT-T095)
informs: []            # doc provenance: ids of work items this item feeds — reverse of produced_by (KIT-T095)
links: []
files: []              # repo-root-relative paths this ticket touches
tier:                  # OPTIONAL dispatch firepower: light | standard | deep — expands to (model, effort)
                       # via config.dispatch.tiers (KIT-T034). Blank = config.dispatch.default_tier[type].
model:                 # OPTIONAL override: opus | sonnet | haiku — pins the subagent model, beating tier.
effort:                # OPTIONAL override: low | medium | high | xhigh | max — pins reasoning effort, beating tier.
supersedes:            # ticket id this one RETIRES (set on the NEWER ticket)
superseded_by:         # ticket id that retired THIS one (drops it from the active board + drain)
created: 2026-07-14T17:40:14.699Z
updated: 2026-07-14T17:40:14.699Z
---

## Description
MAGIC-NUMBERS PRE-WRITE GATE FIRES ON CONFIG / INFRA FILES — false positive. Hit 2026-06-12 writing a Docker/nginx/Let's-Encrypt deploy for client-rx-clinical (CRX-T004): the gate blocked `EXPOSE 3000` in a Dockerfile, and would equally block `listen 443 ssl;` / `listen 80;` in nginx conf, `rsa_key_size=4096` and `sleep 6h` in a bootstrap shell script, and port mappings in docker-compose.yml. These are conventional infrastructure constants (ports, RSA key sizes, renewal intervals) that are NOT extractable code constants — a Dockerfile `EXPOSE` takes a literal; nginx `listen` requires the literal port; compose `ports:` are literals. PROFILE of the false positive: the check is meaningful for application source (JS/TS) but not for config/infra file TYPES. FIX options: (a) default-exclude config file types from magic-numbers in the hook itself — YAML at minimum (it's used almost exclusively for config, Chris's call), and strongly consider Dockerfile, `*.conf`/nginx, and shell `.sh`; (b) keep the check restricted to the languages code-graph indexes (JS/TS) the way source-discovery greps are scoped (cf. KIT-T085); (c) ship a default `.claude-kit-ignore.yaml.example` that pre-excludes these infra globs. Worked around for now with a project-level `.claude-kit-ignore.yaml` in client-rx-clinical (magic-numbers excludes Dockerfile, docker-compose.yml, nginx/**, init-letsencrypt.sh, **/*.yaml, **/*.yml) — but that per-project patch shouldn't be necessary; the gate should not treat config/infra literals as magic numbers by default.

## Acceptance Criteria
<!-- Each must be a checkable observation. Claude ticks these as it satisfies them.
     EVIDENCE FLOOR (KIT-T061): the closing transition (→review when config.uat: required,
     →done when none) requires this ticket to cite a test artifact — a test path, a suite-run
     reference (npm test / "N passed"), or the fixing commit sha — OR an explicit
     [no-test: <reason>]. The commit gate blocks the close otherwise. -->
- [ ]

## Plan
<!-- filled in before editing; Claude waits for OK if the plan changes scope -->
1.

## Notes
<!-- prose/narrative progress — free-form, direct-edit. Context, blockers, research,
     why a tradeoff was made. Append freely; no format enforced. -->

## History
<!-- structured event log — APPEND-ONLY, stamped by the `t` CLI (KIT-T075). One line per
     event, oldest first. Format: - [YYYY-MM-DD HH:MM] (event) detail
     events: created | status | comment | decision | blocker | unblocked | fixed | regressed
       (status)    todo → doing            (a transition)
       (comment)   free-text progress / why
       (decision)  what was chosen — cross-cut ones also go in DECISIONS.md
       (blocker)   <title> — open          (unblocked) <title> — <resolution>
       (fixed)     <sha>                    (regressed) → T-040   (recurred as)
     NEVER edit or delete a prior line — this is the task's audit trail (KIT-D037). -->
- [<YYYY-MM-DD HH:MM>] (created)
