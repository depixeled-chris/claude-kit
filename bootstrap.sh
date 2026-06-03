#!/usr/bin/env sh
# bootstrap.sh — thin POSIX convenience wrapper. The real, cross-platform installer is
# bootstrap.mjs (Node runs on Windows/macOS/Linux; this kept `./bootstrap.sh` muscle
# memory working on POSIX shells). On Windows, run `node bootstrap.mjs` directly.
# All flags pass through: DRY_RUN=1 ./bootstrap.sh, LINK_TOOLING=1 ./bootstrap.sh.
exec node "$(dirname "$0")/bootstrap.mjs" "$@"
