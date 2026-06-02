#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_VERSION="$(node -p "require(process.argv[1]).version" "$PROJECT_DIR/package.json")"
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

APP_NAME="Car Care Log"
DMG_PATH="$PROJECT_DIR/release/Car-Care-Log-$APP_VERSION-$APP_ARCH.dmg"

has_api_key_notary_credentials() {
  [[ -n "${APPLE_API_KEY:-}" && -n "${APPLE_API_KEY_ID:-}" ]]
}

has_apple_id_notary_credentials() {
  [[ -n "${APPLE_ID:-}" && -n "${APPLE_APP_SPECIFIC_PASSWORD:-}" && -n "${APPLE_TEAM_ID:-}" ]]
}

has_keychain_notary_credentials() {
  [[ -n "${APPLE_NOTARIZE_KEYCHAIN_PROFILE:-}" || -n "${APPLE_KEYCHAIN_PROFILE:-}" ]]
}

find_packaged_app() {
  local app_path

  for app_path in \
    "$PROJECT_DIR/release/mac-$APP_ARCH/$APP_NAME.app" \
    "$PROJECT_DIR/release/mac/$APP_NAME.app"
  do
    if [[ -d "$app_path" ]]; then
      printf '%s\n' "$app_path"
      return 0
    fi
  done

  find "$PROJECT_DIR/release" -maxdepth 2 -type d -name "$APP_NAME.app" -print -quit
}

if [[ -z "${CSC_NAME:-}" ]]; then
  cat >&2 <<'EOF'
Set CSC_NAME to your Developer ID Application signing identity before building a signed DMG.
Example value formats:
- Your Name (TEAMID)
- Developer ID Application: Your Name (TEAMID)
EOF
  exit 1
fi

ELECTRON_BUILDER_IDENTITY="$CSC_NAME"
ELECTRON_BUILDER_IDENTITY="${ELECTRON_BUILDER_IDENTITY#Developer ID Application: }"

if ! has_api_key_notary_credentials && ! has_apple_id_notary_credentials && ! has_keychain_notary_credentials; then
  cat >&2 <<'EOF'
Set notarization credentials before building a signed DMG.
Use one of:
- APPLE_API_KEY and APPLE_API_KEY_ID, with APPLE_API_ISSUER for Team API keys
- APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
- APPLE_NOTARIZE_KEYCHAIN_PROFILE, with optional APPLE_NOTARIZE_KEYCHAIN
- Legacy APPLE_KEYCHAIN_PROFILE, with optional APPLE_KEYCHAIN
EOF
  exit 1
fi

cd "$PROJECT_DIR"

npm run icon:generate
npm run build

APPLE_NOTARIZE=1 npx electron-builder --config electron-builder.config.cjs --mac --publish never \
  -c.mac.identity="$ELECTRON_BUILDER_IDENTITY"

if [[ ! -f "$DMG_PATH" ]]; then
  echo "Expected signed DMG was not created: $DMG_PATH" >&2
  exit 1
fi

APP_PATH="$(find_packaged_app)"
if [[ -z "$APP_PATH" ]]; then
  echo "Expected packaged app was not created under release/." >&2
  exit 1
fi

npm run verify:runtime-assets -- --app "$APP_PATH"
npm run smoke:packaged -- --app "$APP_PATH"

codesign --verify --deep --strict --verbose=2 "$APP_PATH"
codesign --force --sign "$CSC_NAME" --timestamp "$DMG_PATH"

if has_api_key_notary_credentials; then
  api_key_args=(--key "$APPLE_API_KEY" --key-id "$APPLE_API_KEY_ID")
  if [[ -n "${APPLE_API_ISSUER:-}" ]]; then
    api_key_args+=(--issuer "$APPLE_API_ISSUER")
  fi
  xcrun notarytool submit "$DMG_PATH" \
    "${api_key_args[@]}" \
    --wait
elif has_apple_id_notary_credentials; then
  xcrun notarytool submit "$DMG_PATH" \
    --apple-id "$APPLE_ID" \
    --password "$APPLE_APP_SPECIFIC_PASSWORD" \
    --team-id "$APPLE_TEAM_ID" \
    --wait
else
  KEYCHAIN_PROFILE="${APPLE_NOTARIZE_KEYCHAIN_PROFILE:-${APPLE_KEYCHAIN_PROFILE:-}}"
  KEYCHAIN_PATH="${APPLE_NOTARIZE_KEYCHAIN:-${APPLE_KEYCHAIN:-}}"
  if [[ -n "$KEYCHAIN_PATH" ]]; then
    xcrun notarytool submit "$DMG_PATH" \
      --keychain "$KEYCHAIN_PATH" \
      --keychain-profile "$KEYCHAIN_PROFILE" \
      --wait
  else
    xcrun notarytool submit "$DMG_PATH" \
      --keychain-profile "$KEYCHAIN_PROFILE" \
      --wait
  fi
fi

xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"
spctl --assess --type open --context context:primary-signature -vvv "$DMG_PATH"
spctl --assess --type execute -vvv "$APP_PATH"
