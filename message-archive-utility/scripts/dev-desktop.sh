#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
BACKEND_PORT="${MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT:-8765}"
FRONTEND_URL="http://127.0.0.1:${FRONTEND_PORT}"
FRONTEND_PID=""

cleanup() {
  if [[ -n "$FRONTEND_PID" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi
}

is_frontend_ready() {
  curl -s -o /dev/null -w '%{http_code}' "$FRONTEND_URL" 2>/dev/null | grep -q '^200$'
}

wait_for_frontend() {
  for _ in $(seq 1 60); do
    if is_frontend_ready; then
      return 0
    fi
    sleep 0.5
  done

  printf 'Frontend did not become ready at %s\n' "$FRONTEND_URL" >&2
  return 1
}

trap cleanup EXIT INT TERM

if is_frontend_ready; then
  printf 'Using existing frontend at %s\n' "$FRONTEND_URL"
else
  printf 'Starting frontend on %s\n' "$FRONTEND_URL"
  (
    cd "$FRONTEND_DIR"
    VITE_API_PROXY_TARGET="http://127.0.0.1:${BACKEND_PORT}" \
      npm run dev -- --port "$FRONTEND_PORT"
  ) &
  FRONTEND_PID="$!"
  wait_for_frontend
fi

MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT="$BACKEND_PORT" \
  MESSAGE_ARCHIVE_BACKEND_RELOAD=1 \
  ELECTRON_START_URL="$FRONTEND_URL" \
  npm --prefix "$ROOT_DIR/desktop" run dev
