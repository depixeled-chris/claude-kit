#!/usr/bin/env bash
# Statusline: model, branch, context %, cost. Caches git per session_id so it
# never hangs the UI. Wire via settings.json: statusLine.command -> this file.
input=$(cat)
get() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

MODEL=$(get '.model.display_name')
CTX=$(get '.context_window.used_percentage // 0' | cut -d. -f1)
COST=$(get '.cost.total_cost_usd // 0')
SID=$(get '.session_id')

CACHE="/tmp/statusline-git-$SID"
if [ ! -f "$CACHE" ] || [ "$(($(date +%s) - $(stat -f %m "$CACHE" 2>/dev/null || stat -c %Y "$CACHE" 2>/dev/null || echo 0)))" -gt 5 ]; then
  git branch --show-current >"$CACHE" 2>/dev/null || true
fi
BRANCH=$(cat "$CACHE" 2>/dev/null)

printf '[%s] %s | ctx:%s%% | $%.2f' "$MODEL" "${BRANCH:-no-git}" "$CTX" "$COST"
