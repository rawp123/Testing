#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  if [[ -n "$BACKEND_PID" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi

  if [[ -n "$FRONTEND_PID" ]]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi

  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

require_file() {
  local path="$1"
  local message="$2"

  if [[ ! -e "$path" ]]; then
    printf '%s\n' "$message" >&2
    exit 1
  fi
}

require_file "$BACKEND_DIR/.venv/bin/uvicorn" "Backend dependencies are missing. Run: cd message-archive-utility/backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
require_file "$FRONTEND_DIR/node_modules/.bin/vite" "Frontend dependencies are missing. Run: cd message-archive-utility/frontend && npm install"

trap cleanup EXIT INT TERM

printf 'Starting backend on http://%s:%s\n' "$BACKEND_HOST" "$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  MESSAGE_ARCHIVE_DB_PATH="${MESSAGE_ARCHIVE_DB_PATH:-data/message-archive.sqlite3}" \
    .venv/bin/uvicorn app.main:app --reload --host "$BACKEND_HOST" --port "$BACKEND_PORT"
) &
BACKEND_PID="$!"

printf 'Starting frontend on http://localhost:%s\n' "$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  VITE_API_PROXY_TARGET="http://$BACKEND_HOST:$BACKEND_PORT" \
    npm run dev -- --port "$FRONTEND_PORT"
) &
FRONTEND_PID="$!"

wait -n "$BACKEND_PID" "$FRONTEND_PID"
