#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$VENV_DIR/bin/python"
else
  if command -v python3 >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python3"
  elif command -v python >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python"
  else
    echo "Python is required to download podcast audio from RSS." >&2
    exit 1
  fi

  "$BOOTSTRAP_PYTHON" -m venv "$VENV_DIR"
  PYTHON_BIN="$VENV_DIR/bin/python"
fi

if ! "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1
import importlib.util

required = ["requests"]
missing = [name for name in required if importlib.util.find_spec(name) is None]
raise SystemExit(1 if missing else 0)
PY
then
  PIP_DISABLE_PIP_VERSION_CHECK=1 "$PYTHON_BIN" -m pip install -r "$ROOT_DIR/requirements.txt"
fi

"$PYTHON_BIN" "$ROOT_DIR/scripts/downloadAllInPodcastAudioFromRss.py" "$@"
