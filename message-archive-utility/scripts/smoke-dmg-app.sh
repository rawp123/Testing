#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_VERSION="$(node -p "require(process.argv[1]).version" "$PROJECT_DIR/desktop/package.json")"
MACHINE_ARCH="$(uname -m)"
case "$MACHINE_ARCH" in
  x86_64)
    APP_ARCH="x64"
    ;;
  arm64)
    APP_ARCH="arm64"
    ;;
  *)
    APP_ARCH="$MACHINE_ARCH"
    ;;
esac

DMG_PATH="${1:-$PROJECT_DIR/release/mac/Message Archive Utility-$APP_VERSION-$APP_ARCH.dmg}"
MOUNT_DIR_RAW="$(mktemp -d "${TMPDIR:-/tmp}/message-archive-dmg-smoke-XXXXXX")"
MOUNT_DIR="$(cd "$MOUNT_DIR_RAW" && pwd -P)"

is_mounted() {
  mount | grep -F " on $MOUNT_DIR " >/dev/null 2>&1
}

cleanup() {
  set +e
  if is_mounted; then
    hdiutil detach "$MOUNT_DIR" -quiet >/dev/null 2>&1 ||
      hdiutil detach "$MOUNT_DIR" -force -quiet >/dev/null 2>&1 ||
      true
  fi
  if ! is_mounted; then
    rm -rf "$MOUNT_DIR"
  fi
}

trap cleanup EXIT INT TERM

if [[ ! -f "$DMG_PATH" ]]; then
  echo "DMG was not found at $DMG_PATH. Run npm run pack:mac:dmg:signed first." >&2
  exit 1
fi

hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -nobrowse -readonly -quiet
MESSAGE_ARCHIVE_APP="$MOUNT_DIR/Message Archive Utility.app" "$PROJECT_DIR/scripts/smoke-installed-app.sh"
