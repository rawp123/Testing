#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

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

if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  printf 'Installing backend dependencies...\n'
  (
    cd "$BACKEND_DIR"
    if [[ ! -d .venv ]]; then
      "$PYTHON_BIN" -m venv .venv
    fi
    .venv/bin/python -m pip install -r requirements.txt
  )
fi

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
  printf 'Installing frontend dependencies...\n'
  (
    cd "$FRONTEND_DIR"
    npm install
  )
fi

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
