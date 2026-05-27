#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
BACKEND_VENV_DIR="${MESSAGE_ARCHIVE_BACKEND_VENV_DIR:-$ROOT_DIR/.venv}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
DIST_DIR="$ROOT_DIR/release/backend"
BUILD_DIR="$ROOT_DIR/release/backend-build"
SPEC_DIR="$ROOT_DIR/release/backend-spec"

if [[ ! -x "$BACKEND_VENV_DIR/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$BACKEND_VENV_DIR"
fi

"$BACKEND_VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"

rm -rf "$DIST_DIR" "$BUILD_DIR" "$SPEC_DIR"
mkdir -p "$DIST_DIR" "$BUILD_DIR" "$SPEC_DIR"

(
  cd "$BACKEND_DIR"
  "$BACKEND_VENV_DIR/bin/python" -m PyInstaller \
    --clean \
    --noconfirm \
    --onefile \
    --name message-archive-backend \
    --distpath "$DIST_DIR" \
    --workpath "$BUILD_DIR" \
    --specpath "$SPEC_DIR" \
    --add-data "$BACKEND_DIR/app/db:app/db" \
    --add-data "$BACKEND_DIR/tests/fixtures:tests/fixtures" \
    desktop_server.py
)

printf 'Backend executable built at %s\n' "$DIST_DIR/message-archive-backend"
