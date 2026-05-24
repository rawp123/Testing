#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_PORT="${MESSAGE_ARCHIVE_DESKTOP_BACKEND_PORT:-8765}"

printf 'Building desktop frontend for http://127.0.0.1:%s\n' "$BACKEND_PORT"
(
  cd "$FRONTEND_DIR"
  VITE_API_BASE_URL="http://127.0.0.1:${BACKEND_PORT}" npm run build
)

printf 'Desktop frontend built at %s\n' "$FRONTEND_DIR/dist"
