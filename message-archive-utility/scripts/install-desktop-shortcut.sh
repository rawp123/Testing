#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAUNCH_SCRIPT="$ROOT_DIR/scripts/launch-desktop.sh"
APP_NAME="Message Archive Utility"

if [[ ! -x "$LAUNCH_SCRIPT" ]]; then
  chmod +x "$LAUNCH_SCRIPT"
fi

case "$(uname -s)" in
  Darwin)
    DESKTOP_DIR="$HOME/Desktop"
    APP_BUNDLE_PATH="$DESKTOP_DIR/$APP_NAME.app"
    APP_CONTENTS_DIR="$APP_BUNDLE_PATH/Contents"
    APP_MACOS_DIR="$APP_CONTENTS_DIR/MacOS"
    APP_EXECUTABLE="$APP_MACOS_DIR/$APP_NAME"
    mkdir -p "$DESKTOP_DIR"
    rm -rf "$APP_BUNDLE_PATH"
    mkdir -p "$APP_MACOS_DIR"
    cat > "$APP_EXECUTABLE" <<EOF
#!/usr/bin/env bash
cd "$ROOT_DIR"
"$LAUNCH_SCRIPT"
EOF
    chmod +x "$APP_EXECUTABLE"
    cat > "$APP_CONTENTS_DIR/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>$APP_NAME</string>
  <key>CFBundleIdentifier</key>
  <string>local.message-archive-utility</string>
  <key>CFBundleName</key>
  <string>$APP_NAME</string>
  <key>CFBundleDisplayName</key>
  <string>$APP_NAME</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
</dict>
</plist>
EOF
    printf 'Installed desktop app: %s\n' "$APP_BUNDLE_PATH"
    ;;
  Linux)
    DESKTOP_DIR="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
    SHORTCUT_PATH="$DESKTOP_DIR/message-archive-utility.desktop"
    mkdir -p "$DESKTOP_DIR"
    cat > "$SHORTCUT_PATH" <<EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=Open your local text message archive
Exec=$LAUNCH_SCRIPT
Path=$ROOT_DIR
Terminal=false
Categories=Utility;
EOF
    chmod +x "$SHORTCUT_PATH"
    printf 'Installed desktop launcher: %s\n' "$SHORTCUT_PATH"
    ;;
  *)
    printf 'Unsupported platform for automatic desktop shortcut installation.\n' >&2
    printf 'You can still run: %s\n' "$LAUNCH_SCRIPT" >&2
    exit 1
    ;;
esac
