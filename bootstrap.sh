#!/usr/bin/env bash
# bootstrap.sh — wire claude-kit into a machine. Idempotent and conservative:
# it ADDS to ~/.claude (symlinks commands + statusline) and never overwrites
# your existing settings.json or CLAUDE.md. Run after cloning the repo.
#
#   ./bootstrap.sh
#
# On native Windows, run under WSL so all machines stay POSIX.
set -euo pipefail

KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$HOME/.claude"
mkdir -p "$CLAUDE/commands"

link() { # link <src> <dst> — back up a real file, then symlink
  local src="$1" dst="$2"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    mv "$dst" "$dst.bak.$(date +%s)"
    echo "  backed up existing $dst"
  fi
  ln -sfn "$src" "$dst"
  echo "  linked $dst"
}

echo "Linking slash commands -> $CLAUDE/commands/"
for f in "$KIT"/user-config/commands/*.md; do
  link "$f" "$CLAUDE/commands/$(basename "$f")"
done

echo "Linking statusline"
link "$KIT/user-config/statusline.sh" "$CLAUDE/statusline.sh"
chmod +x "$KIT/user-config/statusline.sh" "$KIT/scripts/"*.mjs 2>/dev/null || true

echo "Linking skills -> $CLAUDE/skills/"
mkdir -p "$CLAUDE/skills"
for d in "$KIT"/skills/*/; do
  [ -d "$d" ] || continue
  link "${d%/}" "$CLAUDE/skills/$(basename "$d")"
done

echo "Linking agents -> $CLAUDE/agents/"
mkdir -p "$CLAUDE/agents"
for f in "$KIT"/agents/*.md; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = "README.md" ] && continue
  link "$f" "$CLAUDE/agents/$(basename "$f")"
done

# Enforcement hooks are wired through settings (PreToolUse/SessionStart/PreCompact/Stop)
# pointing at "$KIT"/hooks/*.mjs. They are being ported to Node; until then they are
# declared in user-config/settings.recommended.json, which you merge below.

CAP_LINE="cap(){ node \"$KIT/scripts/cap.mjs\" \"\$@\"; }"
echo
echo "Add this to your shell rc (~/.zshrc on mac, ~/.bashrc on Linux/WSL):"
echo "  $CAP_LINE"
echo
echo "Then merge user-config/settings.recommended.json into $CLAUDE/settings.json"
echo "(it enables the statusline + pre-allows the cap/init scripts)."
echo
echo "Per project, run:  node $KIT/scripts/init-project.mjs   (inside the repo)"
echo "Done."
