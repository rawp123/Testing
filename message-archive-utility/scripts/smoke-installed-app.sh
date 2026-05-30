#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-${MESSAGE_ARCHIVE_APP:-/Applications/Message Archive Utility.app}}"
APP_NAME="Message Archive Utility"
APP_EXECUTABLE="$APP_PATH/Contents/MacOS/$APP_NAME"
APP_BACKEND_EXECUTABLE="$APP_PATH/Contents/Resources/backend/message-archive-backend"
SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/message-archive-installed-smoke-XXXXXX")"
SMOKE_DATA_DIR="$SMOKE_ROOT/data"
SMOKE_EXPORT_DIR="$SMOKE_ROOT/exports"
SMOKE_PORT="${MESSAGE_ARCHIVE_SMOKE_PORT:-}"
SMOKE_API_TOKEN="${MESSAGE_ARCHIVE_API_TOKEN:-}"
APP_PID=""

cleanup() {
  set +e
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.25
    done
    kill "$APP_PID" >/dev/null 2>&1 || true
  fi

  if [[ -n "$SMOKE_PORT" ]]; then
    local backend_pids
    backend_pids="$(lsof -ti "tcp:$SMOKE_PORT" 2>/dev/null || true)"
    if [[ -n "$backend_pids" ]]; then
      kill $backend_pids >/dev/null 2>&1 || true
    fi
  fi
}

trap cleanup EXIT INT TERM

fail() {
  printf 'Smoke test failed: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

find_open_port() {
  python3 - <<'PY'
import socket

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
    sock.bind(("127.0.0.1", 0))
    print(sock.getsockname()[1])
PY
}

generate_api_token() {
  python3 - <<'PY'
import secrets

print(secrets.token_hex(32))
PY
}

curl_auth() {
  curl -fsS -H "X-Message-Archive-Token: $SMOKE_API_TOKEN" "$@"
}

wait_for_health() {
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$SMOKE_PORT/health" >"$SMOKE_ROOT/health.json" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

assert_health() {
  python3 - "$SMOKE_ROOT/health.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    health = json.load(handle)

if health.get("status") != "ok":
    raise SystemExit("health status was not ok")
if health.get("desktop_mode") is not True:
    raise SystemExit("desktop_mode was not true")
if health.get("auth_required") is not True:
    raise SystemExit("auth_required was not true")
PY
}

assert_backend_from_app() {
  local backend_processes
  backend_processes="$(ps -axo command | grep -F "$APP_BACKEND_EXECUTABLE" | grep -F -- "--port $SMOKE_PORT" | grep -v grep || true)"
  if [[ -z "$backend_processes" ]]; then
    fail "Bundled backend process was not found for port $SMOKE_PORT"
  fi
  if ps -axo command | grep -F ".venv/bin/uvicorn" | grep -F -- "--port $SMOKE_PORT" | grep -v grep >/dev/null 2>&1; then
    fail "Smoke backend is using project .venv instead of bundled app resources"
  fi
}

assert_api_auth_required() {
  local no_token_status
  local wrong_token_status
  no_token_status="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:$SMOKE_PORT/archive/stats")"
  wrong_token_status="$(curl -sS -o /dev/null -w "%{http_code}" -H "X-Message-Archive-Token: wrong" "http://127.0.0.1:$SMOKE_PORT/archive/stats")"

  [[ "$no_token_status" == "401" ]] || fail "Local API accepted a protected request without a token"
  [[ "$wrong_token_status" == "401" ]] || fail "Local API accepted a protected request with the wrong token"
  curl_auth "http://127.0.0.1:$SMOKE_PORT/archive/stats" >/dev/null
}

launch_app() {
  APP_PID=""
  env -u ELECTRON_RUN_AS_NODE \
    MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT="$SMOKE_PORT" \
    MESSAGE_ARCHIVE_API_TOKEN="$SMOKE_API_TOKEN" \
    MESSAGE_ARCHIVE_DATA_DIR="$SMOKE_DATA_DIR" \
    MESSAGE_ARCHIVE_DB_PATH="$SMOKE_DATA_DIR/message-archive.sqlite3" \
    "$APP_EXECUTABLE" >/dev/null 2>&1 &
  APP_PID="$!"
  wait_for_health || fail "App backend did not become healthy"
  assert_health
  assert_backend_from_app
  assert_api_auth_required
}

quit_app() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    osascript -e "quit app \"$APP_NAME\"" >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      kill -0 "$APP_PID" 2>/dev/null || break
      sleep 0.25
    done
  fi

  local backend_pids
  backend_pids="$(lsof -ti "tcp:$SMOKE_PORT" 2>/dev/null || true)"
  if [[ -n "$backend_pids" ]]; then
    kill $backend_pids >/dev/null 2>&1 || true
    for _ in $(seq 1 20); do
      lsof -ti "tcp:$SMOKE_PORT" >/dev/null 2>&1 || break
      sleep 0.25
    done
  fi
  APP_PID=""
}

assert_stats() {
  python3 - "$SMOKE_ROOT/stats.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    stats = json.load(handle)

messages = stats.get("messages", {}).get("total")
conversations = stats.get("conversations", {}).get("total")
if messages != 4:
    raise SystemExit(f"expected 4 fake messages, got {messages!r}")
if conversations != 2:
    raise SystemExit(f"expected 2 fake conversations, got {conversations!r}")
PY
}

assert_search() {
  python3 - "$SMOKE_ROOT/search.json" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    search = json.load(handle)

if search.get("total_matching_messages", 0) < 1:
    raise SystemExit("expected at least one fake search result")
PY
}

download_and_assert_content_type() {
  local url="$1"
  local output="$2"
  local expected_type="$3"
  local headers="$output.headers"

  curl_auth -D "$headers" -o "$output" "$url"
  [[ -s "$output" ]] || fail "Export output was empty: $output"
  grep -i "^content-type: $expected_type" "$headers" >/dev/null \
    || fail "Unexpected content type for $url"
}

run_fake_data_checks() {
  curl_auth -X POST "http://127.0.0.1:$SMOKE_PORT/dev/import-sample" >"$SMOKE_ROOT/import.json"
  curl_auth "http://127.0.0.1:$SMOKE_PORT/archive/stats" >"$SMOKE_ROOT/stats.json"
  assert_stats

  curl_auth "http://127.0.0.1:$SMOKE_PORT/search?q=coffee" >"$SMOKE_ROOT/search.json"
  assert_search

  mkdir -p "$SMOKE_EXPORT_DIR"
  download_and_assert_content_type \
    "http://127.0.0.1:$SMOKE_PORT/export/messages.pdf" \
    "$SMOKE_EXPORT_DIR/messages.pdf" \
    "application/pdf"
  download_and_assert_content_type \
    "http://127.0.0.1:$SMOKE_PORT/export/messages.xlsx" \
    "$SMOKE_EXPORT_DIR/messages.xlsx" \
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  download_and_assert_content_type \
    "http://127.0.0.1:$SMOKE_PORT/export/messages.csv" \
    "$SMOKE_EXPORT_DIR/messages.csv" \
    "text/csv"
}

require_command curl
require_command lsof
require_command osascript
require_command python3

[[ -d "$APP_PATH" ]] || fail "Installed app was not found: $APP_PATH"
[[ -x "$APP_EXECUTABLE" ]] || fail "App executable was not found: $APP_EXECUTABLE"
[[ -x "$APP_BACKEND_EXECUTABLE" ]] || fail "Bundled backend executable was not found: $APP_BACKEND_EXECUTABLE"

mkdir -p "$SMOKE_DATA_DIR" "$SMOKE_EXPORT_DIR"
if [[ -z "$SMOKE_PORT" ]]; then
  SMOKE_PORT="$(find_open_port)"
fi
if [[ -z "$SMOKE_API_TOKEN" ]]; then
  SMOKE_API_TOKEN="$(generate_api_token)"
fi

printf 'Installed app: %s\n' "$APP_PATH"
printf 'Smoke data: %s\n' "$SMOKE_DATA_DIR"
printf 'Smoke exports: %s\n' "$SMOKE_EXPORT_DIR"
printf 'Smoke backend port: %s\n' "$SMOKE_PORT"

launch_app
run_fake_data_checks
quit_app

launch_app
curl_auth "http://127.0.0.1:$SMOKE_PORT/archive/stats" >"$SMOKE_ROOT/stats-after-reopen.json"
cp "$SMOKE_ROOT/stats-after-reopen.json" "$SMOKE_ROOT/stats.json"
assert_stats
quit_app

printf 'Installed-app smoke test passed.\n'
printf 'Fake export files are in: %s\n' "$SMOKE_EXPORT_DIR"
