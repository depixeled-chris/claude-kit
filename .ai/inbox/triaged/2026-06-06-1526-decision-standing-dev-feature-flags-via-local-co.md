(decision/standing) DEV SHOWS CURRENT WORK BY DEFAULT — feature flags via config, NOT URL params/CLI switches you have to remember. ONLY the maintainer + the agent work on this; no other devs, no production-default to preserve. So:
- `npm run dev` ALWAYS presents what we're currently working on, with NO flags to remember and NO per-machine setup. The COMMITTED defaults (in the devFlag() calls) reflect current WIP — e.g. terrain ON while we're building terrain. Both maintainer machines (macOS + Windows) just run `npm run dev` and see it.
- A `devFlag(name, default)` helper resolves: URL param (`?name=1|0`, an agreed one-off override only) → local gitignored config (`.env.local`, `VITE_FLAG_NAME`) → the committed default. Config/URL only ever OVERRIDE to toggle off or A/B; they're never required for the normal case.
- The annoyance this kills: `?stream=0` / `?rustground=1` URL params. Wire ALL such toggles (streaming, rustground, terrain, future) through devFlag(); never URL-only.
- A committed `.env.local.example` documents the flags. Don't over-engineer for hypothetical other developers — there are none.
Project: HOD.
