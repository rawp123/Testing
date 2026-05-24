#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIST_INDEX="$ROOT_DIR/frontend/dist/index.html"
BACKEND_PORT="${MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT:-8765}"
DEFAULT_DESKTOP_PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

export PATH="$DEFAULT_DESKTOP_PATH:${PATH:-}"

find_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  if [[ -n "${SHELL:-}" && -x "$SHELL" ]]; then
    "$SHELL" -lc 'command -v npm' 2>/dev/null || true
  fi
}

NPM_BIN="$(find_npm)"
if [[ -z "$NPM_BIN" ]]; then
  printf 'Could not find npm. Install Node.js, then reopen Message Archive Utility.\n' >&2
  exit 1
fi
export PATH="$(dirname "$NPM_BIN"):$PATH"

if [[ ! -f "$FRONTEND_DIST_INDEX" ]]; then
  printf 'Desktop frontend build not found. Building it now...\n'
  MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT="$BACKEND_PORT" "$ROOT_DIR/scripts/build-desktop.sh"
fi

printf 'Opening Message Archive Utility desktop app...\n'
MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT="$BACKEND_PORT" \
  "$NPM_BIN" --prefix "$ROOT_DIR/desktop" start
