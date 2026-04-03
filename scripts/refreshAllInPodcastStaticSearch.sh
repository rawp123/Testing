#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV_DIR="$ROOT_DIR/.venv"
ENABLE_ASSEMBLYAI="${ALL_IN_ENABLE_ASSEMBLYAI:-0}"
ENABLE_ASR="${ALL_IN_ENABLE_ASR:-0}"
DOWNLOAD_AUDIO="${ALL_IN_DOWNLOAD_AUDIO:-0}"
TRANSCRIPT_ARGS=()

for ARG in "$@"; do
  if [[ "$ARG" == "--download-audio" ]]; then
    DOWNLOAD_AUDIO=1
    continue
  fi

  if [[ "$ARG" == "--with-assemblyai-fallback" ]]; then
    ENABLE_ASSEMBLYAI=1
    continue
  fi

  if [[ "$ARG" == "--with-asr-fallback" ]]; then
    ENABLE_ASR=1
    continue
  fi

  TRANSCRIPT_ARGS+=("$ARG")
done

if [[ -x "$VENV_DIR/bin/python" ]]; then
  PYTHON_BIN="$VENV_DIR/bin/python"
else
  if command -v python3 >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python3"
  elif command -v python >/dev/null 2>&1; then
    BOOTSTRAP_PYTHON="python"
  else
    echo "Python is required to build static podcast transcripts." >&2
    exit 1
  fi

  "$BOOTSTRAP_PYTHON" -m venv "$VENV_DIR"
  PYTHON_BIN="$VENV_DIR/bin/python"
fi

if ! "$PYTHON_BIN" - "$ENABLE_ASSEMBLYAI" "$ENABLE_ASR" <<'PY' >/dev/null 2>&1
import importlib.util
import sys

modules = ["youtube_transcript_api"]
if sys.argv[1] == "1" or sys.argv[2] == "1":
    modules.append("requests")
if sys.argv[2] == "1":
    modules.extend(["requests", "faster_whisper"])

missing = [name for name in modules if importlib.util.find_spec(name) is None]
raise SystemExit(1 if missing else 0)
PY
then
  PIP_DISABLE_PIP_VERSION_CHECK=1 "$PYTHON_BIN" -m pip install -r "$ROOT_DIR/requirements.txt"
fi

if [[ ${#TRANSCRIPT_ARGS[@]} -eq 0 ]]; then
  TRANSCRIPT_ARGS=(--replace-outline)
fi

if [[ "$ENABLE_ASSEMBLYAI" == "1" && -z "${ASSEMBLYAI_API_KEY:-}" ]]; then
  echo "ASSEMBLYAI_API_KEY is required when AssemblyAI fallback is enabled." >&2
  exit 1
fi

if [[ -n "${ALL_IN_YOUTUBE_PROXY:-${HTTPS_PROXY:-${HTTP_PROXY:-}}}" ]]; then
  echo "Proxy configuration detected for YouTube transcript requests."
fi

echo "Refreshing All-In archive feed..."
/bin/bash "$ROOT_DIR/scripts/fetchAllInPodcastArchive.sh"

if [[ "$DOWNLOAD_AUDIO" == "1" ]]; then
  echo "Downloading RSS audio archive into scripts/podcasts/all-in/raw/audio/..."
  /bin/bash "$ROOT_DIR/scripts/downloadAllInPodcastAudioFromRss.sh"
fi

echo "Backfilling transcript JSON for static search..."
node "$ROOT_DIR/scripts/fetchAllInPodcastYouTubeTranscripts.mjs" "${TRANSCRIPT_ARGS[@]}"

if [[ "$ENABLE_ASSEMBLYAI" == "1" ]]; then
  echo "Running AssemblyAI fallback for episodes still missing transcript overrides..."
  "$PYTHON_BIN" "$ROOT_DIR/scripts/transcribeAllInPodcastAssemblyAI.py" "${TRANSCRIPT_ARGS[@]}"
fi

if [[ "$ENABLE_ASR" == "1" ]]; then
  echo "Running offline ASR fallback for episodes still missing transcript overrides..."
  "$PYTHON_BIN" "$ROOT_DIR/scripts/transcribeAllInPodcastAudio.py" "${TRANSCRIPT_ARGS[@]}"
fi

echo "Rebuilding static podcast search output..."
cd "$ROOT_DIR"
npm run build:all-in-podcast-search
